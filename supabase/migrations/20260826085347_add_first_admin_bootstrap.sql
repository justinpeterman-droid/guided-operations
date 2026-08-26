begin;

alter table app_private.user_accounts
  add column temporary_passcode_expires_at timestamptz;

alter table app_private.user_accounts
  add constraint user_accounts_temporary_passcode_lifecycle_check
  check (
    (must_change_passcode and temporary_passcode_expires_at is not null)
    or (not must_change_passcode and temporary_passcode_expires_at is null)
  );

comment on column app_private.user_accounts.temporary_passcode_expires_at is
  'Expiry for a system-generated temporary passcode. Plaintext credentials are never stored.';

create or replace function app_private.bootstrap_first_administrator(
  p_auth_user_id uuid,
  p_employee_lookup_hash text,
  p_employee_number_hint text,
  p_display_name text,
  p_sign_in_alias text,
  p_temporary_passcode_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_facility_id uuid;
  new_staff_member_id uuid;
begin
  perform pg_advisory_xact_lock(
    hashtextextended('guided-operations/first-admin-bootstrap/v1', 0)
  );

  if exists (select 1 from app_private.user_accounts) then
    raise exception 'First administrator bootstrap is no longer available';
  end if;

  if p_temporary_passcode_expires_at <= statement_timestamp() then
    raise exception 'Temporary passcode expiry must be in the future';
  end if;

  select facility.id
    into strict current_facility_id
    from app_private.facilities as facility
    where facility.singleton_key = 1;

  insert into app_private.staff_members (
    facility_id,
    employee_lookup_hash,
    employee_number_hint,
    display_name,
    status
  ) values (
    current_facility_id,
    p_employee_lookup_hash,
    p_employee_number_hint,
    p_display_name,
    'active'
  )
  returning id into new_staff_member_id;

  insert into app_private.user_accounts (
    auth_user_id,
    staff_member_id,
    sign_in_alias,
    role,
    status,
    must_change_passcode,
    temporary_passcode_expires_at
  ) values (
    p_auth_user_id,
    new_staff_member_id,
    p_sign_in_alias,
    'administrator',
    'pending',
    true,
    p_temporary_passcode_expires_at
  );

  insert into app_private.audit_events (
    facility_id,
    event_type,
    target_type,
    target_id,
    metadata
  ) values (
    current_facility_id,
    'account.bootstrap.pending',
    'account',
    p_auth_user_id,
    jsonb_build_object('outcome', 'awaiting_private_delivery')
  );

  return new_staff_member_id;
end;
$$;

comment on function app_private.bootstrap_first_administrator(
  uuid, text, text, text, text, timestamptz
) is
  'Zero-account-only private bootstrap. It creates a pending administrator that cannot sign in until separate protected delivery succeeds.';

create or replace function app_private.activate_bootstrapped_administrator(
  p_auth_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_facility_id uuid;
begin
  select staff.facility_id
    into strict current_facility_id
    from app_private.user_accounts as account
    join app_private.staff_members as staff on staff.id = account.staff_member_id
    where account.auth_user_id = p_auth_user_id
      and account.role = 'administrator'
      and account.status = 'pending'
      and account.must_change_passcode
      and account.temporary_passcode_expires_at > statement_timestamp();

  update app_private.user_accounts
    set status = 'active'
    where auth_user_id = p_auth_user_id
      and status = 'pending';

  insert into app_private.audit_events (
    facility_id,
    event_type,
    target_type,
    target_id,
    metadata
  ) values (
    current_facility_id,
    'account.bootstrap.activated',
    'account',
    p_auth_user_id,
    jsonb_build_object('outcome', 'private_delivery_confirmed')
  );
end;
$$;

create or replace function app_private.abandon_bootstrapped_administrator(
  p_auth_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  pending_staff_member_id uuid;
  current_facility_id uuid;
begin
  select account.staff_member_id, staff.facility_id
    into strict pending_staff_member_id, current_facility_id
    from app_private.user_accounts as account
    join app_private.staff_members as staff on staff.id = account.staff_member_id
    where account.auth_user_id = p_auth_user_id
      and account.role = 'administrator'
      and account.status = 'pending';

  delete from app_private.user_accounts
    where auth_user_id = p_auth_user_id
      and status = 'pending';

  delete from app_private.staff_members
    where id = pending_staff_member_id;

  insert into app_private.audit_events (
    facility_id,
    event_type,
    target_type,
    target_id,
    metadata
  ) values (
    current_facility_id,
    'account.bootstrap.abandoned',
    'account',
    p_auth_user_id,
    jsonb_build_object('outcome', 'private_delivery_failed')
  );
end;
$$;

revoke all on function app_private.bootstrap_first_administrator(
  uuid, text, text, text, text, timestamptz
) from public, anon, authenticated, service_role;
revoke all on function app_private.activate_bootstrapped_administrator(uuid)
  from public, anon, authenticated, service_role;
revoke all on function app_private.abandon_bootstrapped_administrator(uuid)
  from public, anon, authenticated, service_role;

commit;
