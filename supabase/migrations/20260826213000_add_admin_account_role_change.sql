begin;

create or replace function app_private.change_account_role(
  p_actor_auth_user_id uuid,
  p_target_auth_user_id uuid,
  p_new_role app_private.account_role
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_facility_id uuid;
  target_facility_id uuid;
  prior_role app_private.account_role;
begin
  if p_actor_auth_user_id = p_target_auth_user_id then
    raise exception 'An administrator cannot change their own role';
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

  select staff.facility_id, account.role
    into target_facility_id, prior_role
    from app_private.user_accounts as account
    join app_private.staff_members as staff on staff.id = account.staff_member_id
    where account.auth_user_id = p_target_auth_user_id
      and account.status = 'active'
      and staff.status = 'active';
  if not found or target_facility_id <> actor_facility_id then
    raise exception 'Account is unavailable for this administrator';
  end if;
  if prior_role = p_new_role then
    raise exception 'Account already has that role';
  end if;

  update app_private.user_accounts
    set role = p_new_role
    where auth_user_id = p_target_auth_user_id
      and status = 'active';

  insert into app_private.audit_events(
    facility_id, actor_auth_user_id, event_type, target_type, target_id, metadata
  ) values (
    actor_facility_id,
    p_actor_auth_user_id,
    'account.role.changed',
    'account',
    p_target_auth_user_id,
    jsonb_build_object('prior_role', prior_role, 'new_role', p_new_role)
  );
end;
$$;

comment on function app_private.change_account_role(uuid, uuid, app_private.account_role) is
  'Private same-facility role change. The lifecycle trigger protects the last active administrator and advances auth_version.';

revoke all on function app_private.change_account_role(uuid, uuid, app_private.account_role)
  from public, anon, authenticated, service_role;

commit;
