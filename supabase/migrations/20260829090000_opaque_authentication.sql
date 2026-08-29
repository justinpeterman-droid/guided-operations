begin;

-- This migration intentionally only supports the verified zero-account foundation.
do $$
begin
  if exists (select 1 from app_private.user_accounts)
     or exists (select 1 from app_private.audit_events) then
    raise exception 'opaque authentication migration requires the verified zero-account/no-operational-data foundation';
  end if;
end
$$;

-- Replace the unused Supabase-Auth identity columns without editing the applied foundation migration.
alter table app_private.user_accounts add column id uuid not null default gen_random_uuid();
alter table app_private.user_accounts drop constraint user_accounts_pkey;
alter table app_private.user_accounts add primary key (id);
alter table app_private.user_accounts drop column auth_user_id;
alter table app_private.user_accounts drop column sign_in_alias;
comment on table app_private.user_accounts is
  'Authoritative application account state for opaque employee authentication.';

alter table app_private.audit_events add column actor_account_id uuid
  references app_private.user_accounts(id) on delete set null;
drop index if exists app_private.audit_events_actor_occurred_idx;
alter table app_private.audit_events drop column actor_auth_user_id;
create index audit_events_actor_account_occurred_idx
  on app_private.audit_events (actor_account_id, occurred_at desc)
  where actor_account_id is not null;

create table app_private.user_credentials (
  account_id uuid primary key references app_private.user_accounts(id) on delete cascade,
  passcode_hash text not null check (char_length(passcode_hash) between 40 and 512),
  credential_version integer not null default 1 check (credential_version > 0),
  temporary_expires_at timestamptz,
  changed_at timestamptz not null default statement_timestamp(),
  created_at timestamptz not null default statement_timestamp()
);
comment on table app_private.user_credentials is
  'Argon2id credential hashes only. Plaintext passcodes are never stored.';

create table app_private.user_sessions (
  id uuid primary key,
  account_id uuid not null references app_private.user_accounts(id) on delete cascade,
  secret_hash text not null unique check (secret_hash ~ '^[a-f0-9]{64}$'),
  previous_secret_hash text check (
    previous_secret_hash is null or previous_secret_hash ~ '^[a-f0-9]{64}$'
  ),
  previous_valid_until timestamptz,
  auth_version integer not null check (auth_version > 0),
  device_hash text not null check (device_hash ~ '^[a-f0-9]{64}$'),
  network_hash text not null check (network_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default statement_timestamp(),
  rotated_at timestamptz not null default statement_timestamp(),
  last_seen_at timestamptz not null default statement_timestamp(),
  idle_expires_at timestamptz not null,
  absolute_expires_at timestamptz not null,
  admin_elevated_until timestamptz,
  revoked_at timestamptz,
  revoke_reason text,
  check ((previous_secret_hash is null) = (previous_valid_until is null)),
  check (idle_expires_at <= absolute_expires_at)
);
create index user_sessions_account_active_idx
  on app_private.user_sessions (account_id, revoked_at, absolute_expires_at);
create index user_sessions_idle_expiry_idx on app_private.user_sessions (idle_expires_at);
create index user_sessions_absolute_expiry_idx on app_private.user_sessions (absolute_expires_at);

create table app_private.auth_rate_limits (
  subject_type text not null check (subject_type in ('account', 'device', 'network', 'global')),
  subject_hash text not null check (subject_hash ~ '^[a-f0-9]{64}$'),
  window_started_at timestamptz not null,
  attempts integer not null default 0 check (attempts >= 0),
  blocked_until timestamptz,
  updated_at timestamptz not null default statement_timestamp(),
  primary key (subject_type, subject_hash)
);

create table app_private.admin_step_ups (
  id uuid primary key,
  account_id uuid not null references app_private.user_accounts(id) on delete cascade,
  session_id uuid not null references app_private.user_sessions(id) on delete cascade,
  purpose text not null check (purpose ~ '^[a-z][a-z0-9_.-]{2,80}$'),
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  auth_version integer not null check (auth_version > 0),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default statement_timestamp()
);
create index admin_step_ups_session_active_idx
  on app_private.admin_step_ups (session_id, purpose, expires_at)
  where consumed_at is null;

alter table app_private.user_credentials enable row level security;
alter table app_private.user_credentials force row level security;
alter table app_private.user_sessions enable row level security;
alter table app_private.user_sessions force row level security;
alter table app_private.auth_rate_limits enable row level security;
alter table app_private.auth_rate_limits force row level security;
alter table app_private.admin_step_ups enable row level security;
alter table app_private.admin_step_ups force row level security;

-- Role groups are NOLOGIN. A separate environment-specific login receives membership later.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'guided_operations_preauth') then
    create role guided_operations_preauth nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'guided_operations_runtime') then
    create role guided_operations_runtime nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'guided_operations_app') then
    create role guided_operations_app login noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
  end if;
end
$$;

alter role guided_operations_app password null;
grant guided_operations_preauth to guided_operations_app;
grant guided_operations_runtime to guided_operations_app;

revoke all on schema app_private from guided_operations_app, guided_operations_preauth, guided_operations_runtime;
grant usage on schema app_private to guided_operations_preauth, guided_operations_runtime;

-- Request account context is set only by verified server code inside a transaction.
create or replace function app_private.current_account_id()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  raw_value text;
begin
  raw_value := current_setting('app.current_account_id', true);
  if raw_value is null or raw_value = '' then
    return null;
  end if;
  begin
    return raw_value::uuid;
  exception when invalid_text_representation then
    return null;
  end;
end
$$;

create or replace function app_private.current_account_is_active()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from app_private.user_accounts as account
    where account.id = app_private.current_account_id()
      and account.status = 'active'::app_private.account_status
  );
$$;

create or replace function app_private.current_account_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from app_private.user_accounts as account
    where account.id = app_private.current_account_id()
      and account.status = 'active'::app_private.account_status
      and account.role = 'administrator'::app_private.account_role
  );
$$;

create or replace function app_private.current_staff_member_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select account.staff_member_id
  from app_private.user_accounts as account
  where account.id = app_private.current_account_id()
    and account.status = 'active'::app_private.account_status;
$$;

-- Pre-auth lookup returns only the minimum server-only material needed to verify a login.
create or replace function app_private.preauth_lookup_account(p_employee_lookup_hash text)
returns table (
  account_id uuid,
  staff_member_id uuid,
  passcode_hash text,
  role app_private.account_role,
  status app_private.account_status,
  must_change_passcode boolean,
  failed_attempts integer,
  locked_until timestamptz,
  auth_version integer,
  temporary_expires_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    account.id,
    account.staff_member_id,
    credential.passcode_hash,
    account.role,
    account.status,
    account.must_change_passcode,
    account.failed_attempts,
    account.locked_until,
    account.auth_version,
    credential.temporary_expires_at
  from app_private.staff_members as staff
  join app_private.user_accounts as account on account.staff_member_id = staff.id
  join app_private.user_credentials as credential on credential.account_id = account.id
  where staff.employee_lookup_hash = p_employee_lookup_hash
    and staff.status = 'active'::app_private.staff_status
  limit 1;
$$;

create or replace function app_private.preauth_resolve_session(p_session_id uuid)
returns table (
  session_id uuid,
  account_id uuid,
  secret_hash text,
  previous_secret_hash text,
  previous_valid_until timestamptz,
  session_auth_version integer,
  account_auth_version integer,
  role app_private.account_role,
  status app_private.account_status,
  must_change_passcode boolean,
  rotated_at timestamptz,
  idle_expires_at timestamptz,
  absolute_expires_at timestamptz,
  admin_elevated_until timestamptz,
  revoked_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    session.id,
    session.account_id,
    session.secret_hash,
    session.previous_secret_hash,
    session.previous_valid_until,
    session.auth_version,
    account.auth_version,
    account.role,
    account.status,
    account.must_change_passcode,
    session.rotated_at,
    session.idle_expires_at,
    session.absolute_expires_at,
    session.admin_elevated_until,
    session.revoked_at
  from app_private.user_sessions as session
  join app_private.user_accounts as account on account.id = session.account_id
  where session.id = p_session_id
  limit 1;
$$;

create or replace function app_private.preauth_rate_limit(
  p_subject_type text,
  p_subject_hash text,
  p_limit integer,
  p_window_seconds integer,
  p_block_seconds integer
)
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  now_at timestamptz := statement_timestamp();
  current_row app_private.auth_rate_limits%rowtype;
  safe_limit integer := greatest(1, least(p_limit, 1000));
  safe_window integer := greatest(10, least(p_window_seconds, 86400));
  safe_block integer := greatest(10, least(p_block_seconds, 86400));
begin
  if p_subject_type not in ('account', 'device', 'network', 'global')
     or p_subject_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid rate limit subject';
  end if;

  insert into app_private.auth_rate_limits (
    subject_type, subject_hash, window_started_at, attempts, blocked_until, updated_at
  ) values (
    p_subject_type, p_subject_hash, now_at, 1, null, now_at
  )
  on conflict (subject_type, subject_hash) do update
  set window_started_at = case
        when app_private.auth_rate_limits.window_started_at <= now_at - make_interval(secs => safe_window)
          then now_at
        else app_private.auth_rate_limits.window_started_at
      end,
      attempts = case
        when app_private.auth_rate_limits.window_started_at <= now_at - make_interval(secs => safe_window)
          then 1
        else app_private.auth_rate_limits.attempts + 1
      end,
      updated_at = now_at
  returning * into current_row;

  if current_row.blocked_until is not null and current_row.blocked_until > now_at then
    return query select false, greatest(1, ceil(extract(epoch from current_row.blocked_until - now_at))::integer);
    return;
  end if;

  if current_row.attempts > safe_limit then
    update app_private.auth_rate_limits
    set blocked_until = now_at + make_interval(secs => safe_block), updated_at = now_at
    where subject_type = p_subject_type and subject_hash = p_subject_hash;
    return query select false, safe_block;
    return;
  end if;

  return query select true, 0;
end
$$;

-- Runtime helpers expose safe current-user DTOs only.
create or replace function app_private.runtime_current_account()
returns table (
  account_id uuid,
  staff_member_id uuid,
  display_name text,
  employee_number_hint text,
  role app_private.account_role,
  status app_private.account_status,
  must_change_passcode boolean,
  auth_version integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    account.id,
    staff.id,
    staff.display_name,
    staff.employee_number_hint,
    account.role,
    account.status,
    account.must_change_passcode,
    account.auth_version
  from app_private.user_accounts as account
  join app_private.staff_members as staff on staff.id = account.staff_member_id
  where account.id = app_private.current_account_id()
    and account.status = 'active'::app_private.account_status
    and staff.status = 'active'::app_private.staff_status;
$$;

-- RLS remains default deny except for the current active account's safe rows.
create policy user_accounts_self_select on app_private.user_accounts
for select to guided_operations_runtime
using (id = app_private.current_account_id() and app_private.current_account_is_active());

create policy staff_members_self_select on app_private.staff_members
for select to guided_operations_runtime
using (id = app_private.current_staff_member_id() and app_private.current_account_is_active());

grant select on app_private.user_accounts to guided_operations_runtime;
grant select on app_private.staff_members to guided_operations_runtime;

revoke all on all tables in schema app_private from guided_operations_preauth;
revoke all on all tables in schema app_private from guided_operations_app;

revoke all on all functions in schema app_private from public, anon, authenticated, service_role,
  guided_operations_app, guided_operations_preauth, guided_operations_runtime;

grant execute on function app_private.preauth_lookup_account(text) to guided_operations_preauth;
grant execute on function app_private.preauth_resolve_session(uuid) to guided_operations_preauth;
grant execute on function app_private.preauth_rate_limit(text, text, integer, integer, integer) to guided_operations_preauth;
grant execute on function app_private.current_account_id() to guided_operations_runtime;
grant execute on function app_private.current_account_is_active() to guided_operations_runtime;
grant execute on function app_private.current_account_is_admin() to guided_operations_runtime;
grant execute on function app_private.current_staff_member_id() to guided_operations_runtime;
grant execute on function app_private.runtime_current_account() to guided_operations_runtime;

commit;
