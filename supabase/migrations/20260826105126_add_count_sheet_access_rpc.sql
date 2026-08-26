begin;

create or replace function api.list_count_sheets(p_work_date date)
returns table (
  record_id uuid,
  work_date date,
  shift_code text,
  current_revision_number integer,
  validation jsonb,
  updated_at timestamptz
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
  if p_work_date is null then
    raise exception using errcode = '22023', message = 'Invalid Count Sheet work date';
  end if;

  select account.role::text, staff.facility_id, staff.shift_code
    into actor_role, actor_facility_id, actor_shift_code
    from app_private.user_accounts as account
    join app_private.staff_members as staff on staff.id = account.staff_member_id
    where account.auth_user_id = auth.uid()
      and account.status = 'active'
      and staff.status = 'active';

  if not found or (actor_role <> 'administrator' and actor_shift_code is null) then
    return;
  end if;

  return query
    select
      record.id,
      record.work_date,
      record.shift_code,
      record.current_revision_number,
      revision.validation,
      record.updated_at
    from app_private.paperwork_records as record
    join app_private.paperwork_revisions as revision
      on revision.paperwork_record_id = record.id
      and revision.revision_number = record.current_revision_number
    where record.kind = 'count_sheet'
      and record.facility_id = actor_facility_id
      and record.work_date = p_work_date
      and record.archived_at is null
      and (actor_role = 'administrator' or record.shift_code = actor_shift_code)
    order by record.shift_code asc, record.id asc;
end;
$$;

comment on function api.list_count_sheets(date) is
  'Returns Count Sheet summaries to active same-shift officers and active same-facility administrators.';

revoke all on function api.list_count_sheets(date)
  from public, anon, service_role;
grant usage on schema api to authenticated;
grant execute on function api.list_count_sheets(date) to authenticated;

create or replace function api.get_count_sheet(p_record_id uuid)
returns table (
  record_id uuid,
  work_date date,
  shift_code text,
  current_revision_number integer,
  structure jsonb,
  payload jsonb,
  validation jsonb,
  created_at timestamptz,
  updated_at timestamptz
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

  if not found or (actor_role <> 'administrator' and actor_shift_code is null) then
    return;
  end if;

  return query
    select
      record.id,
      record.work_date,
      record.shift_code,
      record.current_revision_number,
      revision.structure,
      revision.payload,
      revision.validation,
      revision.created_at,
      record.updated_at
    from app_private.paperwork_records as record
    join app_private.paperwork_revisions as revision
      on revision.paperwork_record_id = record.id
      and revision.revision_number = record.current_revision_number
    where record.id = p_record_id
      and record.kind = 'count_sheet'
      and record.facility_id = actor_facility_id
      and record.archived_at is null
      and (actor_role = 'administrator' or record.shift_code = actor_shift_code);
end;
$$;

comment on function api.get_count_sheet(uuid) is
  'Returns the current Count Sheet revision only to an active same-shift officer or active same-facility administrator.';

revoke all on function api.get_count_sheet(uuid)
  from public, anon, service_role;
grant usage on schema api to authenticated;
grant execute on function api.get_count_sheet(uuid) to authenticated;

commit;
