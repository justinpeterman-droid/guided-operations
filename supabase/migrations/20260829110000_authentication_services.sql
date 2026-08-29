begin;

create or replace function app_private.preauth_record_login_failure(
  p_account_id uuid,
  p_lock_after integer,
  p_lock_seconds integer
)
returns table (
  failed_attempts integer,
  status app_private.account_status,
  locked_until timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  safe_lock_after integer := greatest(3, least(p_lock_after, 20));
  safe_lock_seconds integer := greatest(30, least(p_lock_seconds, 3600));
begin
  return query
  update app_private.user_accounts as account
  set failed_attempts = account.failed_attempts + 1,
      status = case
        when account.failed_attempts + 1 >= safe_lock_after
          then 'locked'::app_private.account_status
        else account.status
      end,
      locked_until = case
        when account.failed_attempts + 1 >= safe_lock_after
          then statement_timestamp() + make_interval(secs => safe_lock_seconds)
        else account.locked_until
      end
  where account.id = p_account_id
    and account.status in (
      'active'::app_private.account_status,
      'locked'::app_private.account_status
    )
  returning account.failed_attempts, account.status, account.locked_until;
end
$$;

create or replace function app_private.preauth_create_session(
  p_session_id uuid,
  p_account_id uuid,
  p_expected_auth_version integer,
  p_secret_hash text,
  p_device_hash text,
  p_network_hash text,
  p_idle_expires_at timestamptz,
  p_absolute_expires_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  now_at timestamptz := statement_timestamp();
  changed_rows integer;
begin
  if p_secret_hash !~ '^[a-f0-9]{64}$'
     or p_device_hash !~ '^[a-f0-9]{64}$'
     or p_network_hash !~ '^[a-f0-9]{64}$' then
    return false;
  end if;

  if p_idle_expires_at <= now_at
     or p_absolute_expires_at <= p_idle_expires_at
     or p_idle_expires_at > now_at + interval '65 minutes'
     or p_absolute_expires_at > now_at + interval '13 hours' then
    return false;
  end if;

  update app_private.user_accounts as account
  set failed_attempts = 0,
      status = case
        when account.status = 'locked'::app_private.account_status
             and account.locked_until <= now_at
          then 'active'::app_private.account_status
        else account.status
      end,
      locked_until = case
        when account.status = 'locked'::app_private.account_status
             and account.locked_until <= now_at
          then null
        else account.locked_until
      end
  where account.id = p_account_id
    and account.auth_version = p_expected_auth_version
    and (
      account.status = 'active'::app_private.account_status
      or (
        account.status = 'locked'::app_private.account_status
        and account.locked_until <= now_at
      )
    );

  get diagnostics changed_rows = row_count;
  if changed_rows <> 1 then
    return false;
  end if;

  insert into app_private.user_sessions (
    id,
    account_id,
    secret_hash,
    auth_version,
    device_hash,
    network_hash,
    idle_expires_at,
    absolute_expires_at
  ) values (
    p_session_id,
    p_account_id,
    p_secret_hash,
    p_expected_auth_version,
    p_device_hash,
    p_network_hash,
    p_idle_expires_at,
    p_absolute_expires_at
  );

  return true;
exception
  when unique_violation then
    return false;
end
$$;

create or replace function app_private.preauth_refresh_session(
  p_session_id uuid,
  p_presented_hash text,
  p_new_secret_hash text,
  p_new_idle_expires_at timestamptz
)
returns table (
  accepted boolean,
  rotated boolean,
  absolute_expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  now_at timestamptz := statement_timestamp();
  session_row app_private.user_sessions%rowtype;
  account_row app_private.user_accounts%rowtype;
  matches_current boolean;
  matches_previous boolean;
begin
  if p_presented_hash !~ '^[a-f0-9]{64}$'
     or (p_new_secret_hash is not null and p_new_secret_hash !~ '^[a-f0-9]{64}$') then
    return query select false, false, null::timestamptz;
    return;
  end if;

  select * into session_row
  from app_private.user_sessions as session
  where session.id = p_session_id
  for update;

  if not found then
    return query select false, false, null::timestamptz;
    return;
  end if;

  select * into account_row
  from app_private.user_accounts as account
  where account.id = session_row.account_id;

  matches_current := session_row.secret_hash = p_presented_hash;
  matches_previous := session_row.previous_secret_hash = p_presented_hash
    and session_row.previous_valid_until is not null
    and session_row.previous_valid_until > now_at;

  if session_row.revoked_at is not null
     or session_row.idle_expires_at <= now_at
     or session_row.absolute_expires_at <= now_at
     or account_row.status <> 'active'::app_private.account_status
     or account_row.auth_version <> session_row.auth_version
     or not (matches_current or matches_previous) then
    return query select false, false, session_row.absolute_expires_at;
    return;
  end if;

  if p_new_idle_expires_at <= now_at
     or p_new_idle_expires_at > now_at + interval '65 minutes'
     or p_new_idle_expires_at > session_row.absolute_expires_at then
    return query select false, false, session_row.absolute_expires_at;
    return;
  end if;

  if matches_current
     and p_new_secret_hash is not null
     and session_row.rotated_at <= now_at - interval '30 minutes' then
    update app_private.user_sessions
    set previous_secret_hash = secret_hash,
        previous_valid_until = now_at + interval '30 seconds',
        secret_hash = p_new_secret_hash,
        rotated_at = now_at,
        last_seen_at = now_at,
        idle_expires_at = p_new_idle_expires_at
    where id = p_session_id;

    return query select true, true, session_row.absolute_expires_at;
    return;
  end if;

  update app_private.user_sessions
  set last_seen_at = now_at,
      idle_expires_at = p_new_idle_expires_at
  where id = p_session_id;

  return query select true, false, session_row.absolute_expires_at;
end
$$;

create or replace function app_private.preauth_revoke_session(
  p_session_id uuid,
  p_presented_hash text,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed_rows integer;
begin
  if p_presented_hash !~ '^[a-f0-9]{64}$'
     or p_reason !~ '^[a-z][a-z0-9_.-]{2,80}$' then
    return false;
  end if;

  update app_private.user_sessions as session
  set revoked_at = statement_timestamp(),
      revoke_reason = p_reason
  where session.id = p_session_id
    and session.revoked_at is null
    and (
      session.secret_hash = p_presented_hash
      or (
        session.previous_secret_hash = p_presented_hash
        and session.previous_valid_until > statement_timestamp()
      )
    );

  get diagnostics changed_rows = row_count;
  return changed_rows = 1;
end
$$;

create or replace function app_private.runtime_change_passcode(
  p_new_passcode_hash text,
  p_expected_auth_version integer
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  account_id uuid := app_private.current_account_id();
  next_auth_version integer;
  facility_id uuid;
begin
  if account_id is null
     or char_length(p_new_passcode_hash) not between 40 and 512 then
    return null;
  end if;

  update app_private.user_accounts as account
  set auth_version = account.auth_version + 1,
      must_change_passcode = false,
      failed_attempts = 0,
      locked_until = null,
      status = 'active'::app_private.account_status
  where account.id = account_id
    and account.status = 'active'::app_private.account_status
    and account.auth_version = p_expected_auth_version
  returning account.auth_version into next_auth_version;

  if next_auth_version is null then
    return null;
  end if;

  update app_private.user_credentials as credential
  set passcode_hash = p_new_passcode_hash,
      credential_version = credential.credential_version + 1,
      temporary_expires_at = null,
      changed_at = statement_timestamp()
  where credential.account_id = account_id;

  update app_private.user_sessions
  set revoked_at = statement_timestamp(),
      revoke_reason = 'credential-change'
  where user_sessions.account_id = account_id
    and user_sessions.revoked_at is null;

  select staff.facility_id into facility_id
  from app_private.user_accounts as account
  join app_private.staff_members as staff on staff.id = account.staff_member_id
  where account.id = account_id;

  insert into app_private.audit_events (
    facility_id,
    actor_account_id,
    event_type,
    target_type,
    target_id,
    metadata
  ) values (
    facility_id,
    account_id,
    'account.passcode_changed',
    'account',
    account_id,
    jsonb_build_object('auth_version', next_auth_version)
  );

  return next_auth_version;
end
$$;

create or replace function app_private.runtime_revoke_all_sessions(
  p_reason text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  account_id uuid := app_private.current_account_id();
  next_auth_version integer;
  facility_id uuid;
begin
  if account_id is null or p_reason !~ '^[a-z][a-z0-9_.-]{2,80}$' then
    return null;
  end if;

  update app_private.user_accounts as account
  set auth_version = account.auth_version + 1
  where account.id = account_id
    and account.status = 'active'::app_private.account_status
  returning account.auth_version into next_auth_version;

  if next_auth_version is null then
    return null;
  end if;

  update app_private.user_sessions
  set revoked_at = statement_timestamp(),
      revoke_reason = p_reason
  where user_sessions.account_id = account_id
    and user_sessions.revoked_at is null;

  select staff.facility_id into facility_id
  from app_private.user_accounts as account
  join app_private.staff_members as staff on staff.id = account.staff_member_id
  where account.id = account_id;

  insert into app_private.audit_events (
    facility_id,
    actor_account_id,
    event_type,
    target_type,
    target_id,
    metadata
  ) values (
    facility_id,
    account_id,
    'account.sessions_revoked',
    'account',
    account_id,
    jsonb_build_object('auth_version', next_auth_version, 'reason', p_reason)
  );

  return next_auth_version;
end
$$;

revoke all on function app_private.preauth_record_login_failure(uuid, integer, integer)
  from public, anon, authenticated, service_role, guided_operations_app, guided_operations_runtime;
revoke all on function app_private.preauth_create_session(uuid, uuid, integer, text, text, text, timestamptz, timestamptz)
  from public, anon, authenticated, service_role, guided_operations_app, guided_operations_runtime;
revoke all on function app_private.preauth_refresh_session(uuid, text, text, timestamptz)
  from public, anon, authenticated, service_role, guided_operations_app, guided_operations_runtime;
revoke all on function app_private.preauth_revoke_session(uuid, text, text)
  from public, anon, authenticated, service_role, guided_operations_app, guided_operations_runtime;
revoke all on function app_private.runtime_change_passcode(text, integer)
  from public, anon, authenticated, service_role, guided_operations_app, guided_operations_preauth;
revoke all on function app_private.runtime_revoke_all_sessions(text)
  from public, anon, authenticated, service_role, guided_operations_app, guided_operations_preauth;

grant execute on function app_private.preauth_record_login_failure(uuid, integer, integer)
  to guided_operations_preauth;
grant execute on function app_private.preauth_create_session(uuid, uuid, integer, text, text, text, timestamptz, timestamptz)
  to guided_operations_preauth;
grant execute on function app_private.preauth_refresh_session(uuid, text, text, timestamptz)
  to guided_operations_preauth;
grant execute on function app_private.preauth_revoke_session(uuid, text, text)
  to guided_operations_preauth;
grant execute on function app_private.runtime_change_passcode(text, integer)
  to guided_operations_runtime;
grant execute on function app_private.runtime_revoke_all_sessions(text)
  to guided_operations_runtime;

commit;
