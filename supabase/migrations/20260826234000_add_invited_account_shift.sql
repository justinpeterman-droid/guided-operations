begin;

drop function app_private.stage_invited_account(
  uuid, uuid, text, text, text, app_private.account_role, text, timestamptz
);

create function app_private.stage_invited_account(
  p_actor_auth_user_id uuid,
  p_auth_user_id uuid,
  p_employee_lookup_hash text,
  p_employee_number_hint text,
  p_display_name text,
  p_role app_private.account_role,
  p_shift_code text,
  p_sign_in_alias text,
  p_temporary_passcode_expires_at timestamptz
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_facility_id uuid;
  staff_id uuid;
begin
  if p_temporary_passcode_expires_at <= statement_timestamp()
    or p_temporary_passcode_expires_at > statement_timestamp() + interval '1 hour' then
    raise exception 'Invalid temporary passcode expiry';
  end if;
  if p_shift_code not in ('A', 'B', 'C', 'D', 'U', 'F') then
    raise exception 'Invalid shift assignment';
  end if;

  select staff.facility_id
    into actor_facility_id
    from app_private.user_accounts as account
    join app_private.staff_members as staff on staff.id = account.staff_member_id
    where account.auth_user_id = p_actor_auth_user_id
      and account.role = 'administrator'
      and account.status = 'active'
      and staff.status = 'active';
  if not found then
    raise exception 'Current active administrator required';
  end if;

  insert into app_private.staff_members (
    facility_id, employee_lookup_hash, employee_number_hint,
    display_name, shift_code, status
  ) values (
    actor_facility_id, p_employee_lookup_hash, p_employee_number_hint,
    p_display_name, p_shift_code, 'active'
  ) returning id into staff_id;

  insert into app_private.user_accounts (
    auth_user_id, staff_member_id, sign_in_alias, role, status,
    must_change_passcode, temporary_passcode_expires_at
  ) values (
    p_auth_user_id, staff_id, p_sign_in_alias, p_role, 'pending',
    true, p_temporary_passcode_expires_at
  );

  insert into app_private.audit_events (
    facility_id, actor_auth_user_id, event_type, target_type, target_id, metadata
  ) values (
    actor_facility_id, p_actor_auth_user_id, 'account.invited.pending',
    'account', p_auth_user_id,
    jsonb_build_object('outcome', 'awaiting_in_person_delivery', 'shift_code', p_shift_code)
  );
end;
$$;

comment on function app_private.stage_invited_account(
  uuid, uuid, text, text, text, app_private.account_role, text, text, timestamptz
) is
  'Stages a same-facility invited account with an approved shift after protected administrator authorization.';

revoke all on function app_private.stage_invited_account(
  uuid, uuid, text, text, text, app_private.account_role, text, text, timestamptz
) from public, anon, authenticated, service_role;

drop function api.list_admin_accounts(integer);

create function api.list_admin_accounts(p_limit integer default 50)
returns table (
  account_id uuid,
  employee_number_hint text,
  display_name text,
  shift_code text,
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
      staff.shift_code,
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
  'Returns the bounded summary-only facility account and assigned-shift list for an active administrator.';

revoke all on function api.list_admin_accounts(integer)
  from public, anon, service_role;
grant usage on schema api to authenticated;
grant execute on function api.list_admin_accounts(integer) to authenticated;

commit;
