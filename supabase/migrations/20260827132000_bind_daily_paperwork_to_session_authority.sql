begin;

create function app_private.current_daily_paperwork_admin_facility_id()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  claimed_auth_version_text text;
  claimed_auth_version integer;
  authorized_facility_id uuid;
begin
  if auth.uid() is null
    or jsonb_typeof(auth.jwt()->'app_metadata'->'auth_version') <> 'number' then
    return null;
  end if;

  claimed_auth_version_text := auth.jwt()->'app_metadata'->>'auth_version';
  if claimed_auth_version_text is null
    or claimed_auth_version_text !~ '^[1-9][0-9]{0,8}$' then
    return null;
  end if;
  claimed_auth_version := claimed_auth_version_text::integer;

  select staff.facility_id
    into authorized_facility_id
    from app_private.user_accounts as account
    join app_private.staff_members as staff on staff.id = account.staff_member_id
    where account.auth_user_id = auth.uid()
      and account.auth_version = claimed_auth_version
      and account.role = 'administrator'
      and account.status = 'active'
      and not account.must_change_passcode
      and staff.status = 'active';

  return authorized_facility_id;
exception
  when invalid_text_representation or numeric_value_out_of_range then
    return null;
end;
$$;

comment on function app_private.current_daily_paperwork_admin_facility_id() is
  'Returns a facility only for a current active administrator JWT whose auth version still matches the authoritative account.';

revoke all on function app_private.current_daily_paperwork_admin_facility_id()
  from public, anon, authenticated, service_role;

revoke execute on function api.list_daily_paperwork_status(date, text)
  from authenticated;
revoke execute on function api.get_daily_paperwork_template(uuid, date)
  from authenticated;

create function api.list_daily_paperwork_status_v2(
  p_work_date date,
  p_shift_code text
)
returns table (
  template_code text,
  display_title text,
  configured boolean,
  template_id uuid,
  template_version integer,
  print_orientation text,
  capabilities text[],
  record_id uuid,
  current_revision_number integer,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if app_private.current_daily_paperwork_admin_facility_id() is null then
    return;
  end if;

  return query
    select *
    from api.list_daily_paperwork_status(p_work_date, p_shift_code);
end;
$$;

comment on function api.list_daily_paperwork_status_v2(date, text) is
  'Session-version-bound administrator Daily Paperwork catalog. It returns no form body.';

create function api.get_daily_paperwork_template_v2(
  p_template_id uuid,
  p_work_date date
)
returns table (
  template_id uuid,
  template_code text,
  title text,
  version integer,
  source_revision text,
  source_sha256 text,
  print_orientation text,
  capabilities text[],
  structure jsonb,
  field_schema jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if app_private.current_daily_paperwork_admin_facility_id() is null then
    return;
  end if;

  return query
    select *
    from api.get_daily_paperwork_template(p_template_id, p_work_date);
end;
$$;

comment on function api.get_daily_paperwork_template_v2(uuid, date) is
  'Session-version-bound reader for one approved private Daily Paperwork template.';

revoke all on function api.list_daily_paperwork_status_v2(date, text)
  from public, anon, service_role;
revoke all on function api.get_daily_paperwork_template_v2(uuid, date)
  from public, anon, service_role;

grant execute on function api.list_daily_paperwork_status_v2(date, text)
  to authenticated;
grant execute on function api.get_daily_paperwork_template_v2(uuid, date)
  to authenticated;

commit;
