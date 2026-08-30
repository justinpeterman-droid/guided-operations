begin;

create table app_private.admin_step_ups (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references auth.users(id) on delete restrict,
  auth_version integer not null check (auth_version > 0),
  session_id uuid not null,
  purpose text not null check (
    purpose in (
      'account.create',
      'account.reset_passcode',
      'account.unlock',
      'account.change_role',
      'account.disable',
      'policy.promote',
      'system.destructive_cleanup'
    )
  ),
  token_digest text not null unique
    check (token_digest ~ '^[A-Za-z0-9_-]{40,}$'),
  request_id uuid not null,
  issued_at timestamptz not null default statement_timestamp(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  check (expires_at > issued_at),
  check (consumed_at is null or consumed_at >= issued_at)
);

comment on table app_private.admin_step_ups is
  'Short-lived, account/session/auth-version-bound and single-use proof for one high-impact administrator action. Raw step-up tokens are never stored.';

create index admin_step_ups_active_lookup_idx
  on app_private.admin_step_ups (account_id, session_id, purpose, expires_at)
  where consumed_at is null;

alter table app_private.admin_step_ups enable row level security;
alter table app_private.admin_step_ups force row level security;

revoke all on table app_private.admin_step_ups from public, anon, authenticated, service_role;

create or replace function app_private.issue_admin_step_up(
  p_auth_user_id uuid,
  p_session_id uuid,
  p_auth_version integer,
  p_purpose text,
  p_token_digest text,
  p_request_id uuid,
  p_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  step_up_id uuid;
begin
  if p_expires_at <= statement_timestamp()
    or p_expires_at > statement_timestamp() + interval '10 minutes' then
    raise exception 'Invalid administrator step-up expiry';
  end if;

  perform 1
    from app_private.user_accounts as account
    where account.auth_user_id = p_auth_user_id
      and account.role = 'administrator'
      and account.status = 'active'
      and account.auth_version = p_auth_version;

  if not found then
    raise exception 'Current active administrator required';
  end if;

  insert into app_private.admin_step_ups (
    account_id,
    auth_version,
    session_id,
    purpose,
    token_digest,
    request_id,
    expires_at
  ) values (
    p_auth_user_id,
    p_auth_version,
    p_session_id,
    p_purpose,
    p_token_digest,
    p_request_id,
    p_expires_at
  ) returning id into step_up_id;

  return step_up_id;
end;
$$;

create or replace function app_private.consume_admin_step_up(
  p_auth_user_id uuid,
  p_session_id uuid,
  p_auth_version integer,
  p_purpose text,
  p_token_digest text,
  p_request_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1
    from app_private.user_accounts as account
    where account.auth_user_id = p_auth_user_id
      and account.role = 'administrator'
      and account.status = 'active'
      and account.auth_version = p_auth_version;

  if not found then
    return false;
  end if;

  update app_private.admin_step_ups
    set consumed_at = statement_timestamp()
    where account_id = p_auth_user_id
      and session_id = p_session_id
      and auth_version = p_auth_version
      and purpose = p_purpose
      and token_digest = p_token_digest
      and request_id = p_request_id
      and expires_at > statement_timestamp()
      and consumed_at is null;

  return found;
end;
$$;

comment on function app_private.issue_admin_step_up(uuid, uuid, integer, text, text, uuid, timestamptz) is
  'Private issuance for a fresh active-administrator confirmation. The token is already a keyed digest and expires within ten minutes.';
comment on function app_private.consume_admin_step_up(uuid, uuid, integer, text, text, uuid) is
  'Private atomic single-use consumption of a purpose-bound administrator confirmation.';

revoke all on function app_private.issue_admin_step_up(uuid, uuid, integer, text, text, uuid, timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function app_private.consume_admin_step_up(uuid, uuid, integer, text, text, uuid)
  from public, anon, authenticated, service_role;

commit;
