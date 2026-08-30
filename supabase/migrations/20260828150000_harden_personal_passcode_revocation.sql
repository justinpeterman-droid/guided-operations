begin;

create or replace function app_private.prepare_personal_passcode_change(
  p_auth_user_id uuid,
  p_employee_lookup_hash text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_facility_id uuid;
  pending_until timestamptz;
begin
  select staff.facility_id, account.session_revocation_pending_until
    into strict current_facility_id, pending_until
    from app_private.user_accounts as account
    join app_private.staff_members as staff on staff.id = account.staff_member_id
    where account.auth_user_id = p_auth_user_id
      and account.status = 'active'
      and not account.must_change_passcode
      and staff.status = 'active'
      and staff.employee_lookup_hash = p_employee_lookup_hash
    for update of account;

  if pending_until is not null and pending_until > statement_timestamp() then
    raise exception using
      errcode = '55000',
      message = 'Session revocation is already pending';
  end if;

  update app_private.user_accounts
    set auth_version = auth_version + 1,
        session_revocation_pending_until = statement_timestamp() + interval '10 minutes'
    where auth_user_id = p_auth_user_id;

  insert into app_private.audit_events (
    facility_id,
    actor_auth_user_id,
    event_type,
    target_type,
    target_id,
    metadata
  ) values (
    current_facility_id,
    p_auth_user_id,
    'account.passcode.change.prepared',
    'account',
    p_auth_user_id,
    jsonb_build_object('outcome', 'provider_update_pending')
  );
end;
$$;

comment on function app_private.prepare_personal_passcode_change(uuid, text) is
  'Private first phase that advances session authority and opens a bounded fail-closed window before a personal-passcode provider update.';

create or replace function app_private.record_personal_passcode_change(
  p_auth_user_id uuid,
  p_employee_lookup_hash text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_facility_id uuid;
  pending_until timestamptz;
begin
  select staff.facility_id, account.session_revocation_pending_until
    into strict current_facility_id, pending_until
    from app_private.user_accounts as account
    join app_private.staff_members as staff on staff.id = account.staff_member_id
    where account.auth_user_id = p_auth_user_id
      and account.status = 'active'
      and not account.must_change_passcode
      and staff.status = 'active'
      and staff.employee_lookup_hash = p_employee_lookup_hash
    for update of account;

  if pending_until is null or pending_until <= statement_timestamp() then
    raise exception using
      errcode = '55000',
      message = 'Session revocation is not pending';
  end if;

  update app_private.user_accounts
    set auth_version = auth_version + 1,
        session_revocation_pending_until = null
    where auth_user_id = p_auth_user_id;

  insert into app_private.audit_events (
    facility_id,
    actor_auth_user_id,
    event_type,
    target_type,
    target_id,
    metadata
  ) values (
    current_facility_id,
    p_auth_user_id,
    'account.passcode.changed',
    'account',
    p_auth_user_id,
    jsonb_build_object('outcome', 'personal_passcode_replaced')
  );
end;
$$;

comment on function app_private.record_personal_passcode_change(uuid, text) is
  'Private final phase that seals session revocation only after the personal passcode and provider sessions were changed.';

revoke all on function app_private.prepare_personal_passcode_change(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function app_private.record_personal_passcode_change(uuid, text)
  from public, anon, authenticated, service_role;

commit;
