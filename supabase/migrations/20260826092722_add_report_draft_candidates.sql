begin;

create table app_private.report_draft_candidates (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references app_private.incidents(id) on delete restrict,
  source_incident_revision_id uuid not null
    references app_private.incident_revisions(id) on delete restrict,
  requested_by_account_id uuid not null
    references app_private.user_accounts(auth_user_id) on delete restrict,
  report_type text not null check (char_length(report_type) between 1 and 100),
  source_fact_ids uuid[] not null check (cardinality(source_fact_ids) between 1 and 300),
  paragraphs jsonb not null check (jsonb_typeof(paragraphs) = 'array'),
  provider_key text not null check (provider_key ~ '^[a-z][a-z0-9_.-]{2,127}$'),
  created_at timestamptz not null default statement_timestamp()
);

comment on table app_private.report_draft_candidates is
  'Immutable, review-only AI draft candidates. Each records only its selected confirmed-fact IDs and validated paragraph provenance.';

create index report_draft_candidates_incident_created_idx
  on app_private.report_draft_candidates (incident_id, created_at desc, id desc);
create index report_draft_candidates_requester_created_idx
  on app_private.report_draft_candidates (requested_by_account_id, created_at desc, id desc);

create trigger report_draft_candidates_immutable
before update or delete on app_private.report_draft_candidates
for each row execute function app_private.reject_mutation();

alter table app_private.report_draft_candidates enable row level security;
alter table app_private.report_draft_candidates force row level security;
revoke all on table app_private.report_draft_candidates
  from public, anon, authenticated, service_role;

create or replace function app_private.validate_report_draft_candidate(
  p_source_incident_revision_id uuid,
  p_source_fact_ids uuid[],
  p_paragraphs jsonb
)
returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  paragraph jsonb;
  source_fact_id text;
begin
  if cardinality(p_source_fact_ids) not between 1 and 300
    or cardinality(p_source_fact_ids) <> cardinality(array(select distinct unnest(p_source_fact_ids)))
    or jsonb_typeof(p_paragraphs) <> 'array'
    or jsonb_array_length(p_paragraphs) not between 1 and 50 then
    raise exception using errcode = '22023', message = 'Invalid report draft candidate';
  end if;

  if exists (
    select 1
    from unnest(p_source_fact_ids) as source(id)
    where not exists (
      select 1
      from app_private.incident_revisions as revision
      cross join lateral jsonb_array_elements(revision.reviewed_facts) as fact(value)
      where revision.id = p_source_incident_revision_id
        and fact.value->>'state' = 'confirmed'
        and fact.value->>'id' = source.id::text
    )
  ) then
    raise exception using errcode = '22023', message = 'Report draft source contains an unconfirmed fact';
  end if;

  for paragraph in select value from jsonb_array_elements(p_paragraphs)
  loop
    if jsonb_typeof(paragraph) <> 'object'
      or not paragraph ?& array['text', 'sourceFactIds']
      or (select count(*) from jsonb_object_keys(paragraph)) <> 2
      or coalesce(char_length(paragraph->>'text'), 0) not between 1 and 4000
      or jsonb_typeof(paragraph->'sourceFactIds') <> 'array'
      or jsonb_array_length(paragraph->'sourceFactIds') not between 1 and 50 then
      raise exception using errcode = '22023', message = 'Invalid report draft paragraph';
    end if;

    for source_fact_id in select value from jsonb_array_elements_text(paragraph->'sourceFactIds')
    loop
      begin
        if not (source_fact_id::uuid = any(p_source_fact_ids)) then
          raise exception using errcode = '22023', message = 'Report draft paragraph referenced a fact outside its source';
        end if;
      exception when invalid_text_representation then
        raise exception using errcode = '22023', message = 'Invalid report draft paragraph';
      end;
    end loop;
  end loop;
end;
$$;

revoke all on function app_private.validate_report_draft_candidate(uuid, uuid[], jsonb)
  from public, anon, authenticated, service_role;

create or replace function api.store_report_draft_candidate(
  p_incident_id uuid,
  p_source_incident_revision_id uuid,
  p_report_type text,
  p_source_fact_ids uuid[],
  p_paragraphs jsonb,
  p_provider_key text,
  p_idempotency_key_digest text,
  p_request_digest text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_role text;
  actor_facility_id uuid;
  existing_request_digest text;
  existing_status text;
  existing_candidate_id uuid;
  candidate_id uuid;
begin
  select account.role::text, staff.facility_id
    into actor_role, actor_facility_id
    from app_private.user_accounts as account
    join app_private.staff_members as staff on staff.id = account.staff_member_id
    where account.auth_user_id = auth.uid()
      and account.status = 'active'
      and staff.status = 'active';

  if not found or not exists (
    select 1 from app_private.incidents as incident
    where incident.id = p_incident_id
      and incident.facility_id = actor_facility_id
      and incident.archived_at is null
      and (actor_role = 'administrator' or incident.created_by_account_id = auth.uid())
  ) or not exists (
    select 1 from app_private.incident_revisions as revision
    where revision.id = p_source_incident_revision_id
      and revision.incident_id = p_incident_id
  ) then
    raise exception using errcode = '42501', message = 'Not authorized to store a report draft candidate';
  end if;

  if p_report_type !~ '[^[:space:]]' or char_length(p_report_type) > 100
    or p_provider_key !~ '^[a-z][a-z0-9_.-]{2,127}$'
    or p_idempotency_key_digest !~ '^[a-f0-9]{64}$'
    or p_request_digest !~ '^[a-f0-9]{64}$' then
    raise exception using errcode = '22023', message = 'Invalid report draft request';
  end if;

  perform app_private.validate_report_draft_candidate(
    p_source_incident_revision_id, p_source_fact_ids, p_paragraphs
  );

  select record.request_digest, record.status, record.result_reference_id
    into existing_request_digest, existing_status, existing_candidate_id
    from app_private.idempotency_records as record
    where record.actor_account_id = auth.uid()
      and record.action = 'report.draft.store'
      and record.idempotency_key_digest = p_idempotency_key_digest
    for update;

  if found then
    if existing_request_digest <> p_request_digest then
      raise exception using errcode = '22023', message = 'Retry key was reused for a different request';
    end if;
    if existing_status = 'succeeded' and existing_candidate_id is not null then
      return existing_candidate_id;
    end if;
    raise exception using errcode = '40001', message = 'Report draft storage is already in progress';
  end if;

  insert into app_private.idempotency_records (
    actor_account_id, action, idempotency_key_digest, request_digest, expires_at
  ) values (
    auth.uid(), 'report.draft.store', p_idempotency_key_digest, p_request_digest,
    statement_timestamp() + interval '24 hours'
  );

  insert into app_private.report_draft_candidates (
    incident_id, source_incident_revision_id, requested_by_account_id, report_type,
    source_fact_ids, paragraphs, provider_key
  ) values (
    p_incident_id, p_source_incident_revision_id, auth.uid(), btrim(p_report_type),
    p_source_fact_ids, p_paragraphs, p_provider_key
  ) returning id into candidate_id;

  update app_private.idempotency_records as record
    set status = 'succeeded', result_reference_id = candidate_id,
        result_code = 'report.draft.stored'
    where record.actor_account_id = auth.uid()
      and record.action = 'report.draft.store'
      and record.idempotency_key_digest = p_idempotency_key_digest;

  return candidate_id;
end;
$$;

comment on function api.store_report_draft_candidate(uuid, uuid, text, uuid[], jsonb, text, text, text) is
  'Atomically stores one validated, immutable review-only report draft candidate for an authorized incident revision.';

revoke all on function api.store_report_draft_candidate(uuid, uuid, text, uuid[], jsonb, text, text, text)
  from public, anon, service_role;
grant usage on schema api to authenticated;
grant execute on function api.store_report_draft_candidate(uuid, uuid, text, uuid[], jsonb, text, text, text)
  to authenticated;

commit;
