begin;

alter table app_private.user_accounts
  add column session_revocation_pending_until timestamptz;

comment on column app_private.user_accounts.session_revocation_pending_until is
  'Short fail-closed window while application and provider session revocation are being reconciled. It auto-expires so a provider outage cannot permanently lock the account.';

create or replace function app_private.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  subject_id uuid;
  current_auth_version integer;
  pending_until timestamptz;
  claims jsonb;
begin
  begin
    subject_id := (event->>'user_id')::uuid;
  exception when invalid_text_representation then
    raise exception using errcode = '22023', message = 'Invalid auth hook subject';
  end;

  select account.auth_version, account.session_revocation_pending_until
    into current_auth_version, pending_until
    from app_private.user_accounts as account
    where account.auth_user_id = subject_id;

  claims := coalesce(event->'claims', '{}'::jsonb);
  claims := jsonb_set(
    claims,
    '{app_metadata}',
    coalesce(claims->'app_metadata', '{}'::jsonb),
    true
  );
  claims := jsonb_set(
    claims,
    '{app_metadata,auth_version}',
    to_jsonb(
      case
        when pending_until > statement_timestamp() then 0
        else coalesce(current_auth_version, 0)
      end
    ),
    true
  );

  return jsonb_build_object('claims', claims);
end;
$$;

comment on function app_private.custom_access_token_hook(jsonb) is
  'Auth hook that overwrites JWT app_metadata.auth_version from the authoritative account row and denies token issuance during a bounded session-revocation reconciliation window.';

revoke all on function app_private.custom_access_token_hook(jsonb)
  from public, anon, authenticated, service_role;
grant usage on schema app_private to supabase_auth_admin;
grant execute on function app_private.custom_access_token_hook(jsonb)
  to supabase_auth_admin;

create or replace function app_private.revoke_personal_sessions(
  p_auth_user_id uuid,
  p_expected_auth_version integer,
  p_outcome text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_facility_id uuid;
  current_auth_version integer;
  current_pending_until timestamptz;
  next_auth_version integer;
begin
  if p_expected_auth_version is null or p_expected_auth_version < 1 then
    raise exception 'Valid session authority is required';
  end if;
  if p_outcome is null or p_outcome not in ('requested', 'completed') then
    raise exception 'Valid session revocation phase is required';
  end if;

  select
      staff.facility_id,
      account.auth_version,
      account.session_revocation_pending_until
    into strict
      current_facility_id,
      current_auth_version,
      current_pending_until
    from app_private.user_accounts as account
    join app_private.staff_members as staff on staff.id = account.staff_member_id
    where account.auth_user_id = p_auth_user_id
      and account.status = 'active'
      and not account.must_change_passcode
      and staff.status = 'active'
    for update of account;

  if current_auth_version <> p_expected_auth_version then
    raise exception 'Session authority changed' using errcode = '40001';
  end if;
  if p_outcome = 'completed'
    and (current_pending_until is null
      or current_pending_until <= statement_timestamp()) then
    raise exception 'Session revocation is not pending';
  end if;

  update app_private.user_accounts
    set
      auth_version = auth_version + 1,
      session_revocation_pending_until = case p_outcome
        when 'requested' then statement_timestamp() + interval '10 minutes'
        else null
      end
    where auth_user_id = p_auth_user_id
    returning auth_version into strict next_auth_version;

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
    'account.sessions.revoked',
    'account',
    p_auth_user_id,
    jsonb_build_object('scope', 'global', 'outcome', p_outcome)
  );

  return next_auth_version;
end;
$$;

comment on function app_private.revoke_personal_sessions(uuid, integer, text) is
  'Private compare-and-swap session-generation advance with a bounded fail-closed reconciliation window, used before and after provider-wide sign-out to deny old and concurrently refreshed access tokens.';

revoke all on function app_private.revoke_personal_sessions(uuid, integer, text)
  from public, anon, authenticated, service_role;

commit;
