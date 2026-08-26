begin;

create or replace function app_private.complete_temporary_passcode_change(
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
begin
  select staff.facility_id
    into strict current_facility_id
    from app_private.user_accounts as account
    join app_private.staff_members as staff on staff.id = account.staff_member_id
    where account.auth_user_id = p_auth_user_id
      and account.status = 'active'
      and account.must_change_passcode
      and account.temporary_passcode_expires_at > statement_timestamp()
      and staff.status = 'active'
      and staff.employee_lookup_hash = p_employee_lookup_hash;

  update app_private.user_accounts
    set must_change_passcode = false,
        temporary_passcode_expires_at = null
    where auth_user_id = p_auth_user_id
      and must_change_passcode;

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
    jsonb_build_object('outcome', 'temporary_passcode_replaced')
  );
end;
$$;

comment on function app_private.complete_temporary_passcode_change(uuid, text) is
  'Private completion of a current, unexpired forced passcode change. The employee value is a keyed digest; this routine records no credential or raw employee number.';

revoke all on function app_private.complete_temporary_passcode_change(uuid, text)
  from public, anon, authenticated, service_role;

commit;
