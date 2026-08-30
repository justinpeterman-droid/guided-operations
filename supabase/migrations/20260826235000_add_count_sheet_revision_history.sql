begin;

create or replace function api.list_count_sheet_revisions(p_record_id uuid)
returns table (
  revision_number integer,
  reason text,
  validation jsonb,
  created_at timestamptz,
  is_current boolean,
  restored_from_revision_number integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_role text;
  actor_facility_id uuid;
  actor_shift_code text;
begin
  if p_record_id is null then
    raise exception using errcode = '22023', message = 'Invalid Count Sheet reference';
  end if;

  select account.role::text, staff.facility_id, staff.shift_code
    into actor_role, actor_facility_id, actor_shift_code
    from app_private.user_accounts as account
    join app_private.staff_members as staff on staff.id = account.staff_member_id
    where account.auth_user_id = auth.uid()
      and account.status = 'active'
      and staff.status = 'active';

  if not found then return; end if;

  return query
    select
      revision.revision_number,
      revision.reason,
      revision.validation,
      revision.created_at,
      revision.revision_number = record.current_revision_number,
      nullif(revision.provenance ->> 'restored_from_revision_number', '')::integer
    from app_private.paperwork_records as record
    join app_private.paperwork_revisions as revision
      on revision.paperwork_record_id = record.id
    where record.id = p_record_id
      and record.kind = 'count_sheet'
      and record.facility_id = actor_facility_id
      and record.archived_at is null
      and (actor_role = 'administrator' or record.shift_code = actor_shift_code)
    order by revision.revision_number desc
    limit 100;
end;
$$;

comment on function api.list_count_sheet_revisions(uuid) is
  'Returns up to the latest 100 immutable Count Sheet revision summaries to active same-shift officers and active same-facility administrators.';

create or replace function api.get_count_sheet_revision(
  p_record_id uuid,
  p_revision_number integer
)
returns table (
  record_id uuid,
  work_date date,
  shift_code text,
  current_revision_number integer,
  revision_number integer,
  reason text,
  structure jsonb,
  payload jsonb,
  validation jsonb,
  restored_from_revision_number integer,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_role text;
  actor_facility_id uuid;
  actor_shift_code text;
begin
  if p_record_id is null or p_revision_number is null or p_revision_number < 1 then
    raise exception using errcode = '22023', message = 'Invalid Count Sheet revision reference';
  end if;

  select account.role::text, staff.facility_id, staff.shift_code
    into actor_role, actor_facility_id, actor_shift_code
    from app_private.user_accounts as account
    join app_private.staff_members as staff on staff.id = account.staff_member_id
    where account.auth_user_id = auth.uid()
      and account.status = 'active'
      and staff.status = 'active';

  if not found then return; end if;

  return query
    select
      record.id,
      record.work_date,
      record.shift_code,
      record.current_revision_number,
      revision.revision_number,
      revision.reason,
      revision.structure,
      revision.payload,
      revision.validation,
      nullif(revision.provenance ->> 'restored_from_revision_number', '')::integer,
      revision.created_at
    from app_private.paperwork_records as record
    join app_private.paperwork_revisions as revision
      on revision.paperwork_record_id = record.id
    where record.id = p_record_id
      and record.kind = 'count_sheet'
      and record.facility_id = actor_facility_id
      and record.archived_at is null
      and revision.revision_number = p_revision_number
      and (actor_role = 'administrator' or record.shift_code = actor_shift_code);
end;
$$;

comment on function api.get_count_sheet_revision(uuid, integer) is
  'Returns one immutable Count Sheet revision to active same-shift officers and active same-facility administrators.';

create or replace function api.restore_count_sheet_revision(
  p_record_id uuid,
  p_base_revision_number integer,
  p_restore_revision_number integer,
  p_reason text,
  p_idempotency_key_digest text,
  p_request_digest text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_facility_id uuid;
  actor_shift_code text;
  record app_private.paperwork_records%rowtype;
  target_revision app_private.paperwork_revisions%rowtype;
  prior_request_digest text;
  prior_result_code text;
  next_revision_number integer;
begin
  if p_record_id is null
    or p_base_revision_number is null or p_base_revision_number < 1
    or p_restore_revision_number is null or p_restore_revision_number < 1
    or char_length(coalesce(p_reason, '')) not between 1 and 500
    or p_idempotency_key_digest !~ '^[a-f0-9]{64}$'
    or p_request_digest !~ '^[a-f0-9]{64}$' then
    raise exception using errcode = '22023', message = 'Invalid Count Sheet restore request';
  end if;

  select staff.facility_id, staff.shift_code
    into actor_facility_id, actor_shift_code
    from app_private.user_accounts as account
    join app_private.staff_members as staff on staff.id = account.staff_member_id
    where account.auth_user_id = auth.uid()
      and account.status = 'active'
      and staff.status = 'active';

  if not found or actor_shift_code is null then
    raise exception using errcode = '42501', message = 'Not authorized to restore this Count Sheet';
  end if;

  select candidate.*
    into record
    from app_private.paperwork_records as candidate
    where candidate.id = p_record_id
      and candidate.kind = 'count_sheet'
      and candidate.facility_id = actor_facility_id
      and candidate.shift_code = actor_shift_code
      and candidate.archived_at is null
    for update;

  if not found then
    raise exception using errcode = '42501', message = 'Not authorized to restore this Count Sheet';
  end if;
  if p_base_revision_number <> record.current_revision_number then
    raise exception using errcode = '40001', message = 'Count Sheet revision conflict';
  end if;

  select revision.*
    into target_revision
    from app_private.paperwork_revisions as revision
    where revision.paperwork_record_id = record.id
      and revision.revision_number = p_restore_revision_number;
  if not found then
    raise exception using errcode = '22023', message = 'Count Sheet revision is unavailable for restore';
  end if;

  select request_digest, result_code
    into prior_request_digest, prior_result_code
    from app_private.idempotency_records
    where actor_account_id = auth.uid()
      and action = 'count_sheet.restore'
      and idempotency_key_digest = p_idempotency_key_digest
    for update;

  if found then
    if prior_request_digest <> p_request_digest then
      raise exception using errcode = '22023', message = 'Retry key was reused for a different request';
    end if;
    if prior_result_code ~ '^count_sheet\.restored\.r[1-9][0-9]*$' then
      return substring(prior_result_code from '[0-9]+$')::integer;
    end if;
    raise exception using errcode = '40001', message = 'Count Sheet restore is already in progress';
  end if;

  next_revision_number := record.current_revision_number + 1;
  insert into app_private.idempotency_records (
    actor_account_id, action, idempotency_key_digest, request_digest, expires_at
  ) values (
    auth.uid(), 'count_sheet.restore', p_idempotency_key_digest, p_request_digest,
    statement_timestamp() + interval '24 hours'
  );

  insert into app_private.paperwork_revisions (
    paperwork_record_id, revision_number, editor_account_id, reason,
    structure, payload, validation, provenance
  ) values (
    record.id, next_revision_number, auth.uid(), p_reason,
    target_revision.structure, target_revision.payload, target_revision.validation,
    jsonb_build_object(
      'prior_revision_number', record.current_revision_number,
      'restored_from_revision_number', p_restore_revision_number
    )
  );

  update app_private.idempotency_records
    set status = 'succeeded',
        result_reference_id = record.id,
        result_code = 'count_sheet.restored.r' || next_revision_number::text
    where actor_account_id = auth.uid()
      and action = 'count_sheet.restore'
      and idempotency_key_digest = p_idempotency_key_digest;

  return next_revision_number;
end;
$$;

comment on function api.restore_count_sheet_revision(uuid, integer, integer, text, text, text) is
  'Creates a new immutable Count Sheet revision from a prior same-shift revision with concurrency and idempotency controls.';

revoke all on function api.list_count_sheet_revisions(uuid)
  from public, anon, service_role;
revoke all on function api.get_count_sheet_revision(uuid, integer)
  from public, anon, service_role;
revoke all on function api.restore_count_sheet_revision(uuid, integer, integer, text, text, text)
  from public, anon, service_role;
grant usage on schema api to authenticated;
grant execute on function api.list_count_sheet_revisions(uuid) to authenticated;
grant execute on function api.get_count_sheet_revision(uuid, integer) to authenticated;
grant execute on function api.restore_count_sheet_revision(uuid, integer, integer, text, text, text)
  to authenticated;

commit;
