begin;

create or replace function app_private.prepare_account_passcode_reset(
  p_actor_auth_user_id uuid,
  p_target_auth_user_id uuid,
  p_temporary_passcode_expires_at timestamptz
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
    raise exception 'An administrator cannot reset their own account through this ceremony';
  end if;

  if p_temporary_passcode_expires_at <= statement_timestamp()
    or p_temporary_passcode_expires_at > statement_timestamp() + interval '1 hour' then
    raise exception 'Invalid temporary passcode expiry';
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

  select staff.facility_id
    into target_facility_id
    from app_private.user_accounts as account
    join app_private.staff_members as staff on staff.id = account.staff_member_id
    where account.auth_user_id = p_target_auth_user_id
      and account.status = 'active'
      and staff.status = 'active';
  if not found or target_facility_id <> actor_facility_id then
    raise exception 'Account is unavailable for this administrator';
  end if;

  update app_private.user_accounts
    set must_change_passcode = true,
        temporary_passcode_expires_at = p_temporary_passcode_expires_at,
        auth_version = auth_version + 1
    where auth_user_id = p_target_auth_user_id
      and status = 'active';
  if not found then
    raise exception 'Account is unavailable for this administrator';
  end if;

  insert into app_private.audit_events(
    facility_id, actor_auth_user_id, event_type, target_type, target_id, metadata
  ) values (
    actor_facility_id,
    p_actor_auth_user_id,
    'account.passcode.reset.prepared',
    'account',
    p_target_auth_user_id,
    jsonb_build_object('outcome', 'awaiting_in_person_delivery')
  );
end;
$$;

comment on function app_private.prepare_account_passcode_reset(uuid, uuid, timestamptz) is
  'Private same-facility passcode-reset preparation. It forces a short-lived replacement and revokes old sessions without storing a credential.';

revoke all on function app_private.prepare_account_passcode_reset(uuid, uuid, timestamptz)
  from public, anon, authenticated, service_role;

commit;
