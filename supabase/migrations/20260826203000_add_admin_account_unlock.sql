begin;

create or replace function app_private.unlock_account(
  p_actor_auth_user_id uuid,
  p_target_auth_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_facility_id uuid;
  target_facility_id uuid;
begin
  if p_actor_auth_user_id = p_target_auth_user_id then
    raise exception 'An administrator cannot unlock their own account';
  end if;
  select staff.facility_id into actor_facility_id
    from app_private.user_accounts account
    join app_private.staff_members staff on staff.id = account.staff_member_id
    where account.auth_user_id = p_actor_auth_user_id
      and account.role = 'administrator' and account.status = 'active'
      and staff.status = 'active';
  if not found then raise exception 'Current active administrator required'; end if;
  select staff.facility_id into target_facility_id
    from app_private.user_accounts account
    join app_private.staff_members staff on staff.id = account.staff_member_id
    where account.auth_user_id = p_target_auth_user_id
      and account.status = 'locked' and staff.status = 'active';
  if not found or target_facility_id <> actor_facility_id then
    raise exception 'Account is unavailable for this administrator';
  end if;
  update app_private.user_accounts
    set status = 'active', locked_until = null
    where auth_user_id = p_target_auth_user_id and status = 'locked';
  if not found then raise exception 'Account is unavailable for this administrator'; end if;
  insert into app_private.audit_events(facility_id, actor_auth_user_id, event_type, target_type, target_id, metadata)
    values (actor_facility_id, p_actor_auth_user_id, 'account.unlocked', 'account', p_target_auth_user_id, jsonb_build_object('outcome','unlocked'));
end;
$$;

comment on function app_private.unlock_account(uuid, uuid) is
  'Private same-facility account unlock. The lifecycle trigger advances auth_version to invalidate stale sessions.';

revoke all on function app_private.unlock_account(uuid, uuid)
  from public, anon, authenticated, service_role;

commit;
