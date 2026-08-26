begin;

create or replace function api.list_admin_accounts(p_limit integer default 50)
returns table (
  account_id uuid,
  employee_number_hint text,
  display_name text,
  role text,
  status text,
  must_change_passcode boolean,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_facility_id uuid;
begin
  if p_limit not between 1 and 100 then
    raise exception using errcode = '22023', message = 'Invalid account list limit';
  end if;

  select staff.facility_id
    into actor_facility_id
    from app_private.user_accounts as account
    join app_private.staff_members as staff on staff.id = account.staff_member_id
    where account.auth_user_id = auth.uid()
      and account.role = 'administrator'
      and account.status = 'active'
      and staff.status = 'active';

  if not found then
    return;
  end if;

  return query
    select
      account.auth_user_id,
      staff.employee_number_hint,
      staff.display_name,
      account.role::text,
      account.status::text,
      account.must_change_passcode,
      account.updated_at
    from app_private.user_accounts as account
    join app_private.staff_members as staff on staff.id = account.staff_member_id
    where staff.facility_id = actor_facility_id
    order by staff.display_name asc, account.auth_user_id asc
    limit p_limit;
end;
$$;

comment on function api.list_admin_accounts(integer) is
  'Returns the bounded, summary-only facility account list for an active administrator. It contains no alias, lookup hash, passcode, token, or narrative data.';

revoke all on function api.list_admin_accounts(integer)
  from public, anon, service_role;
grant usage on schema api to authenticated;
grant execute on function api.list_admin_accounts(integer) to authenticated;

commit;
