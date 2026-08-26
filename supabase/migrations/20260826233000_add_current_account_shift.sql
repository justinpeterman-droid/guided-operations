begin;

drop function api.current_account();

create function api.current_account()
returns table (
  auth_user_id uuid,
  facility_id uuid,
  shift_code text,
  role text,
  status text,
  auth_version integer,
  must_change_passcode boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    account.auth_user_id,
    staff.facility_id,
    staff.shift_code,
    account.role::text,
    account.status::text,
    account.auth_version,
    account.must_change_passcode
  from app_private.user_accounts as account
  join app_private.staff_members as staff on staff.id = account.staff_member_id
  where account.auth_user_id = auth.uid()
$$;

comment on function api.current_account() is
  'Returns the minimal authoritative application account and assigned shift for the authenticated JWT subject.';

revoke all on function api.current_account()
  from public, anon, service_role;
grant usage on schema api to authenticated;
grant execute on function api.current_account() to authenticated;

commit;
