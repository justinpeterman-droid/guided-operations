begin;

create table app_private.incident_staff_relationships (
  incident_revision_id uuid not null
    references app_private.incident_revisions(id) on delete cascade,
  staff_member_id uuid not null
    references app_private.staff_members(id) on delete restrict,
  relationship text not null
    check (
      relationship in (
        'reporting_officer',
        'preparer',
        'involved_officer',
        'witness'
      )
    ),
  selected_by_account_id uuid not null
    references app_private.user_accounts(auth_user_id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  primary key (incident_revision_id, staff_member_id, relationship)
);

comment on table app_private.incident_staff_relationships is
  'Immutable per-revision staff attribution. Reporting and preparing relationships grant record access; involved and witness relationships do not.';

create index incident_staff_relationships_staff_revision_idx
  on app_private.incident_staff_relationships (
    staff_member_id,
    relationship,
    incident_revision_id
  );

create trigger incident_staff_relationships_immutable
before update or delete on app_private.incident_staff_relationships
for each row execute function app_private.retention_delete_guard();

create trigger guided_operations_backup_freeze_f841762f9867dae9
before insert or update or delete or truncate
on app_private.incident_staff_relationships
for each statement execute function app_private.require_no_production_backup_write_freeze();

alter table app_private.incident_staff_relationships enable row level security;
alter table app_private.incident_staff_relationships force row level security;
revoke all on table app_private.incident_staff_relationships
  from public, anon, authenticated, service_role;

create or replace function app_private.can_access_incident(p_incident_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from app_private.incidents as incident
    join app_private.user_accounts as account
      on account.auth_user_id = auth.uid()
    join app_private.staff_members as actor_staff
      on actor_staff.id = account.staff_member_id
    where incident.id = p_incident_id
      and incident.facility_id = actor_staff.facility_id
      and incident.archived_at is null
      and account.status = 'active'
      and actor_staff.status = 'active'
      and (
        account.role = 'administrator'
        or incident.created_by_account_id = account.auth_user_id
        or exists (
          select 1
          from app_private.incident_revisions as revision
          join app_private.incident_staff_relationships as relationship
            on relationship.incident_revision_id = revision.id
          where revision.incident_id = incident.id
            and revision.revision_number = incident.current_revision_number
            and relationship.staff_member_id = actor_staff.id
            and relationship.relationship in ('reporting_officer', 'preparer')
        )
      )
  )
$$;

comment on function app_private.can_access_incident(uuid) is
  'Authorizes an active same-facility administrator, creator, reporting officer, or preparer against the current immutable incident revision.';

revoke all on function app_private.can_access_incident(uuid)
  from public, anon, authenticated, service_role;

create or replace function api.list_staff_selection(p_limit integer default 100)
returns table (
  staff_member_id uuid,
  display_name text,
  employee_number_hint text,
  shift_code text,
  is_current_account boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_staff_id uuid;
  actor_facility_id uuid;
begin
  if p_limit not between 1 and 100 then
    raise exception using errcode = '22023', message = 'Invalid staff selection limit';
  end if;

  select staff.id, staff.facility_id
    into actor_staff_id, actor_facility_id
    from app_private.user_accounts as account
    join app_private.staff_members as staff on staff.id = account.staff_member_id
    where account.auth_user_id = auth.uid()
      and account.status = 'active'
      and staff.status = 'active';

  if not found then
    return;
  end if;

  return query
    select
      staff.id,
      staff.display_name,
      staff.employee_number_hint,
      staff.shift_code,
      staff.id = actor_staff_id
    from app_private.staff_members as staff
    join app_private.user_accounts as account
      on account.staff_member_id = staff.id
    where staff.facility_id = actor_facility_id
      and staff.status = 'active'
      and account.status = 'active'
    order by staff.id <> actor_staff_id, staff.display_name, staff.id
    limit p_limit;
end;
$$;

comment on function api.list_staff_selection(integer) is
  'Returns the minimum active same-facility roster fields required to assign incident reporting and preparing relationships.';

revoke all on function api.list_staff_selection(integer)
  from public, anon, service_role;
grant usage on schema api to authenticated;
grant execute on function api.list_staff_selection(integer) to authenticated;

drop function api.create_incident(
  uuid, text, text, timestamptz, text, integer, jsonb, jsonb, text, text
);

create function api.create_incident(
  p_facility_id uuid,
  p_incident_number text,
  p_display_name text,
  p_occurred_at timestamptz,
  p_category text,
  p_schema_version integer,
  p_field_notes jsonb,
  p_reviewed_facts jsonb,
  p_staff_relationships jsonb,
  p_idempotency_key_digest text,
  p_request_digest text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_account_id uuid := auth.uid();
  actor_staff_id uuid;
  actor_facility_id uuid;
  existing_request_digest text;
  existing_status text;
  existing_incident_id uuid;
  incident_id uuid;
  incident_revision_id uuid;
  distinct_staff_count integer;
  active_staff_count integer;
begin
  select staff.id, staff.facility_id
    into actor_staff_id, actor_facility_id
    from app_private.user_accounts as account
    join app_private.staff_members as staff on staff.id = account.staff_member_id
    where account.auth_user_id = v_actor_account_id
      and account.status = 'active'
      and staff.status = 'active';

  if not found or actor_facility_id is distinct from p_facility_id then
    raise exception using errcode = '42501', message = 'Not authorized to create an incident';
  end if;

  if p_idempotency_key_digest !~ '^[a-f0-9]{64}$'
    or p_request_digest !~ '^[a-f0-9]{64}$' then
    raise exception using errcode = '22023', message = 'Invalid retry metadata';
  end if;

  perform app_private.validate_incident_create_payload(
    p_incident_number,
    p_display_name,
    p_occurred_at,
    p_category,
    p_schema_version,
    p_field_notes,
    p_reviewed_facts
  );

  if jsonb_typeof(p_staff_relationships) <> 'array'
    or jsonb_array_length(p_staff_relationships) not between 2 and 61
    or exists (
      select 1
      from jsonb_array_elements(p_staff_relationships) as item(value)
      where jsonb_typeof(item.value) <> 'object'
        or not item.value ?& array['staffMemberId', 'relationship']
        or (select count(*) from jsonb_object_keys(item.value)) <> 2
        or coalesce(item.value->>'staffMemberId', '') !~*
          '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        or item.value->>'relationship' not in (
          'reporting_officer',
          'preparer',
          'involved_officer',
          'witness'
        )
    )
    or (
      select count(*)
      from jsonb_array_elements(p_staff_relationships) as item(value)
      where item.value->>'relationship' = 'reporting_officer'
    ) not between 1 and 20
    or (
      select count(*)
      from jsonb_array_elements(p_staff_relationships) as item(value)
      where item.value->>'relationship' = 'preparer'
    ) <> 1
    or (
      select (item.value->>'staffMemberId')::uuid
      from jsonb_array_elements(p_staff_relationships) as item(value)
      where item.value->>'relationship' = 'preparer'
    ) is distinct from actor_staff_id
    or (
      select count(*)
      from jsonb_array_elements(p_staff_relationships) as item(value)
    ) <> (
      select count(*)
      from (
        select distinct item.value->>'staffMemberId', item.value->>'relationship'
        from jsonb_array_elements(p_staff_relationships) as item(value)
      ) as unique_relationship
    ) then
    raise exception using errcode = '22023', message = 'Invalid incident staff relationships';
  end if;

  select count(distinct (item.value->>'staffMemberId')::uuid)
    into distinct_staff_count
    from jsonb_array_elements(p_staff_relationships) as item(value);

  select count(distinct staff.id)
    into active_staff_count
    from app_private.staff_members as staff
    join app_private.user_accounts as account on account.staff_member_id = staff.id
    where staff.id in (
      select distinct (item.value->>'staffMemberId')::uuid
      from jsonb_array_elements(p_staff_relationships) as item(value)
    )
      and staff.facility_id = actor_facility_id
      and staff.status = 'active'
      and account.status = 'active';

  if active_staff_count <> distinct_staff_count then
    raise exception using errcode = '42501', message = 'Incident staff selection is not available';
  end if;

  select record.request_digest, record.status, record.result_reference_id
    into existing_request_digest, existing_status, existing_incident_id
    from app_private.idempotency_records as record
    where record.actor_account_id = v_actor_account_id
      and record.action = 'incident.create'
      and record.idempotency_key_digest = p_idempotency_key_digest
    for update;

  if found then
    if existing_request_digest <> p_request_digest then
      raise exception using errcode = '22023', message = 'Retry key was reused for a different request';
    end if;
    if existing_status = 'succeeded' and existing_incident_id is not null then
      return existing_incident_id;
    end if;
    raise exception using errcode = '40001', message = 'Incident creation is already in progress';
  end if;

  insert into app_private.idempotency_records (
    actor_account_id,
    action,
    idempotency_key_digest,
    request_digest,
    expires_at
  ) values (
    v_actor_account_id,
    'incident.create',
    p_idempotency_key_digest,
    p_request_digest,
    statement_timestamp() + interval '24 hours'
  );

  insert into app_private.incidents (
    facility_id,
    created_by_account_id,
    incident_number,
    display_name,
    occurred_at,
    category
  ) values (
    p_facility_id,
    v_actor_account_id,
    btrim(p_incident_number),
    btrim(p_display_name),
    p_occurred_at,
    btrim(p_category)
  ) returning id into incident_id;

  insert into app_private.incident_revisions (
    incident_id,
    revision_number,
    editor_account_id,
    schema_version,
    field_notes,
    reviewed_facts
  ) values (
    incident_id,
    1,
    v_actor_account_id,
    p_schema_version,
    p_field_notes,
    p_reviewed_facts
  ) returning id into incident_revision_id;

  insert into app_private.incident_staff_relationships (
    incident_revision_id,
    staff_member_id,
    relationship,
    selected_by_account_id
  )
  select
    incident_revision_id,
    (item.value->>'staffMemberId')::uuid,
    item.value->>'relationship',
    v_actor_account_id
  from jsonb_array_elements(p_staff_relationships) as item(value);

  update app_private.idempotency_records as record
    set status = 'succeeded',
        result_reference_id = incident_id,
        result_code = 'incident.created'
    where record.actor_account_id = v_actor_account_id
      and record.action = 'incident.create'
      and record.idempotency_key_digest = p_idempotency_key_digest;

  return incident_id;
end;
$$;

comment on function api.create_incident(
  uuid, text, text, timestamptz, text, integer, jsonb, jsonb, jsonb, text, text
) is
  'Creates incident revision one with validated reporting/preparing attribution. The actor is the only permitted preparer.';

revoke all on function api.create_incident(
  uuid, text, text, timestamptz, text, integer, jsonb, jsonb, jsonb, text, text
) from public, anon, service_role;
grant execute on function api.create_incident(
  uuid, text, text, timestamptz, text, integer, jsonb, jsonb, jsonb, text, text
) to authenticated;

create or replace function api.list_incidents(p_limit integer default 50)
returns table (
  incident_id uuid,
  incident_number text,
  display_name text,
  status text,
  occurred_at timestamptz,
  category text,
  current_revision_number integer,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_limit not between 1 and 100 then
    raise exception using errcode = '22023', message = 'Invalid incident list limit';
  end if;

  return query
    select
      incident.id,
      incident.incident_number,
      incident.display_name,
      incident.status,
      incident.occurred_at,
      incident.category,
      incident.current_revision_number,
      incident.updated_at
    from app_private.incidents as incident
    where app_private.can_access_incident(incident.id)
    order by incident.updated_at desc, incident.id desc
    limit p_limit;
end;
$$;

comment on function api.list_incidents(integer) is
  'Returns summary-only incidents authorized by current creator, reporting, preparing, or administrator relationships.';

create or replace function api.get_incident_revision(
  p_incident_id uuid,
  p_revision_number integer
)
returns table (
  incident_id uuid,
  incident_number text,
  display_name text,
  incident_revision_id uuid,
  revision_number integer,
  schema_version integer,
  reviewed_facts jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_incident_id is null or p_revision_number < 1 then
    raise exception using errcode = '22023', message = 'Invalid incident revision reference';
  end if;

  return query
    select
      incident.id,
      incident.incident_number,
      incident.display_name,
      revision.id,
      revision.revision_number,
      revision.schema_version,
      revision.reviewed_facts
    from app_private.incidents as incident
    join app_private.incident_revisions as revision
      on revision.incident_id = incident.id
    where incident.id = p_incident_id
      and revision.revision_number = p_revision_number
      and app_private.can_access_incident(incident.id);
end;
$$;

comment on function api.get_incident_revision(uuid, integer) is
  'Returns one immutable revision only through current creator, reporting, preparing, or administrator authority.';

alter table app_private.report_draft_candidates
  add column reporting_staff_member_id uuid not null
    references app_private.staff_members(id) on delete restrict;

comment on column app_private.report_draft_candidates.reporting_staff_member_id is
  'The selected reporting officer. This identity remains outside AI-provider input and survives human preparation.';

create index report_draft_candidates_reporting_staff_created_idx
  on app_private.report_draft_candidates (
    reporting_staff_member_id,
    created_at desc,
    id desc
  );

drop function api.store_report_draft_candidate(
  uuid, uuid, text, uuid[], jsonb, text, text, text
);

create function api.store_report_draft_candidate(
  p_incident_id uuid,
  p_source_incident_revision_id uuid,
  p_reporting_staff_member_id uuid,
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
  existing_request_digest text;
  existing_status text;
  existing_candidate_id uuid;
  candidate_id uuid;
begin
  if not app_private.can_access_incident(p_incident_id)
    or not exists (
      select 1
      from app_private.incident_revisions as revision
      join app_private.incident_staff_relationships as relationship
        on relationship.incident_revision_id = revision.id
      join app_private.staff_members as staff
        on staff.id = relationship.staff_member_id
      join app_private.user_accounts as account
        on account.staff_member_id = staff.id
      where revision.id = p_source_incident_revision_id
        and revision.incident_id = p_incident_id
        and relationship.staff_member_id = p_reporting_staff_member_id
        and relationship.relationship = 'reporting_officer'
        and staff.status = 'active'
        and account.status = 'active'
    ) then
    raise exception using errcode = '42501', message = 'Not authorized to store a report draft candidate';
  end if;

  if p_report_type not in (
      'first_person',
      'supervisor_summary',
      'cover_letter',
      'disciplinary'
    )
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
    actor_account_id,
    action,
    idempotency_key_digest,
    request_digest,
    expires_at
  ) values (
    auth.uid(),
    'report.draft.store',
    p_idempotency_key_digest,
    p_request_digest,
    statement_timestamp() + interval '24 hours'
  );

  insert into app_private.report_draft_candidates (
    incident_id,
    source_incident_revision_id,
    requested_by_account_id,
    reporting_staff_member_id,
    report_type,
    source_fact_ids,
    paragraphs,
    provider_key
  ) values (
    p_incident_id,
    p_source_incident_revision_id,
    auth.uid(),
    p_reporting_staff_member_id,
    p_report_type,
    p_source_fact_ids,
    p_paragraphs,
    p_provider_key
  ) returning id into candidate_id;

  update app_private.idempotency_records as record
    set status = 'succeeded',
        result_reference_id = candidate_id,
        result_code = 'report.draft.stored'
    where record.actor_account_id = auth.uid()
      and record.action = 'report.draft.store'
      and record.idempotency_key_digest = p_idempotency_key_digest;

  return candidate_id;
end;
$$;

comment on function api.store_report_draft_candidate(
  uuid, uuid, uuid, text, uuid[], jsonb, text, text, text
) is
  'Stores a review-only candidate only for a reporting officer selected on the exact immutable source revision.';

revoke all on function api.store_report_draft_candidate(
  uuid, uuid, uuid, text, uuid[], jsonb, text, text, text
) from public, anon, service_role;
grant execute on function api.store_report_draft_candidate(
  uuid, uuid, uuid, text, uuid[], jsonb, text, text, text
) to authenticated;

drop function api.get_report_draft_candidate(uuid);

create function api.get_report_draft_candidate(p_candidate_id uuid)
returns table (
  candidate_id uuid,
  incident_id uuid,
  source_incident_revision_id uuid,
  reporting_staff_member_id uuid,
  reporting_officer_display_name text,
  report_type text,
  source_fact_ids uuid[],
  paragraphs jsonb,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_candidate_id is null then
    raise exception using errcode = '22023', message = 'Invalid report draft candidate reference';
  end if;

  return query
    select
      candidate.id,
      candidate.incident_id,
      candidate.source_incident_revision_id,
      candidate.reporting_staff_member_id,
      reporting_staff.display_name,
      candidate.report_type,
      candidate.source_fact_ids,
      candidate.paragraphs,
      candidate.created_at
    from app_private.report_draft_candidates as candidate
    join app_private.staff_members as reporting_staff
      on reporting_staff.id = candidate.reporting_staff_member_id
    where candidate.id = p_candidate_id
      and app_private.can_access_incident(candidate.incident_id);
end;
$$;

comment on function api.get_report_draft_candidate(uuid) is
  'Returns review-safe candidate content and reporting-officer attribution through current incident authority.';

revoke all on function api.get_report_draft_candidate(uuid)
  from public, anon, service_role;
grant execute on function api.get_report_draft_candidate(uuid)
  to authenticated;

create or replace function api.finalize_report_draft_candidate(
  p_candidate_id uuid,
  p_narrative text,
  p_idempotency_key_digest text,
  p_request_digest text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate_record app_private.report_draft_candidates%rowtype;
  reporting_account_id uuid;
  existing_request_digest text;
  existing_status text;
  existing_report_id uuid;
  report_id uuid;
begin
  select candidate.* into candidate_record
    from app_private.report_draft_candidates as candidate
    where candidate.id = p_candidate_id
      and app_private.can_access_incident(candidate.incident_id);

  if not found then
    raise exception using errcode = '42501', message = 'Not authorized to finalize this report draft';
  end if;

  select account.auth_user_id into reporting_account_id
    from app_private.user_accounts as account
    join app_private.staff_members as staff on staff.id = account.staff_member_id
    where staff.id = candidate_record.reporting_staff_member_id
      and staff.status = 'active'
      and account.status = 'active';

  if not found then
    raise exception using errcode = '42501', message = 'Reporting officer is not available';
  end if;

  if coalesce(char_length(p_narrative), 0) not between 1 and 50000
    or p_idempotency_key_digest !~ '^[a-f0-9]{64}$'
    or p_request_digest !~ '^[a-f0-9]{64}$' then
    raise exception using errcode = '22023', message = 'Invalid report finalization request';
  end if;

  select record.request_digest, record.status, record.result_reference_id
    into existing_request_digest, existing_status, existing_report_id
    from app_private.idempotency_records as record
    where record.actor_account_id = auth.uid()
      and record.action = 'report.finalize'
      and record.idempotency_key_digest = p_idempotency_key_digest
    for update;

  if found then
    if existing_request_digest <> p_request_digest then
      raise exception using errcode = '22023', message = 'Retry key was reused for a different request';
    end if;
    if existing_status = 'succeeded' and existing_report_id is not null then
      return existing_report_id;
    end if;
    raise exception using errcode = '40001', message = 'Report finalization is already in progress';
  end if;

  insert into app_private.idempotency_records (
    actor_account_id,
    action,
    idempotency_key_digest,
    request_digest,
    expires_at
  ) values (
    auth.uid(),
    'report.finalize',
    p_idempotency_key_digest,
    p_request_digest,
    statement_timestamp() + interval '24 hours'
  );

  insert into app_private.reports (
    incident_id,
    report_type,
    reporting_account_id,
    prepared_by_account_id,
    status
  ) values (
    candidate_record.incident_id,
    candidate_record.report_type,
    reporting_account_id,
    candidate_record.requested_by_account_id,
    'complete'
  ) returning id into report_id;

  insert into app_private.report_access (
    report_id, account_id, relationship, granted_by_account_id
  ) values (
    report_id, reporting_account_id, 'owner', auth.uid()
  );

  if candidate_record.requested_by_account_id <> reporting_account_id then
    insert into app_private.report_access (
      report_id, account_id, relationship, granted_by_account_id
    ) values (
      report_id, candidate_record.requested_by_account_id, 'preparer', auth.uid()
    );
  end if;

  insert into app_private.report_revisions (
    report_id,
    revision_number,
    editor_account_id,
    source_incident_revision_id,
    narrative,
    schema_version,
    provenance
  ) values (
    report_id,
    1,
    auth.uid(),
    candidate_record.source_incident_revision_id,
    p_narrative,
    1,
    jsonb_build_object('draft_candidate_id', candidate_record.id::text)
  );

  update app_private.idempotency_records as record
    set status = 'succeeded',
        result_reference_id = report_id,
        result_code = 'report.finalized'
    where record.actor_account_id = auth.uid()
      and record.action = 'report.finalize'
      and record.idempotency_key_digest = p_idempotency_key_digest;

  return report_id;
end;
$$;

comment on function api.finalize_report_draft_candidate(uuid, text, text, text) is
  'Creates the first immutable report revision with distinct reporting officer, preparer, and final editor attribution.';

commit;
