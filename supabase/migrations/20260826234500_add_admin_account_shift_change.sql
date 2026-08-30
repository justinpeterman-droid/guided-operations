begin;

alter table app_private.admin_step_ups
  drop constraint admin_step_ups_purpose_check;
alter table app_private.admin_step_ups
  add constraint admin_step_ups_purpose_check check (
    purpose in (
      'account.create',
      'account.reset_passcode',
      'account.unlock',
      'account.change_role',
      'account.change_shift',
      'account.disable',
      'policy.promote',
      'system.destructive_cleanup'
    )
  );

create function app_private.change_account_shift(
  p_actor_auth_user_id uuid,
  p_target_auth_user_id uuid,
  p_new_shift_code text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_facility_id uuid;
  target_facility_id uuid;
  target_staff_id uuid;
  prior_shift_code text;
begin
  if p_new_shift_code not in ('A', 'B', 'C', 'D', 'U', 'F') then
    raise exception 'Invalid shift assignment';
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

  select staff.facility_id, staff.id, staff.shift_code
    into target_facility_id, target_staff_id, prior_shift_code
    from app_private.user_accounts as account
    join app_private.staff_members as staff on staff.id = account.staff_member_id
    where account.auth_user_id = p_target_auth_user_id
      and account.status = 'active'
      and staff.status = 'active';
  if not found or target_facility_id <> actor_facility_id then
    raise exception 'Account is unavailable for this administrator';
  end if;
  if prior_shift_code = p_new_shift_code then
    raise exception 'Account already has that shift';
  end if;

  update app_private.staff_members
    set shift_code = p_new_shift_code
    where id = target_staff_id;

  update app_private.user_accounts
    set auth_version = auth_version + 1,
        updated_at = statement_timestamp()
    where auth_user_id = p_target_auth_user_id;

  insert into app_private.audit_events (
    facility_id, actor_auth_user_id, event_type, target_type, target_id, metadata
  ) values (
    actor_facility_id,
    p_actor_auth_user_id,
    'account.shift.changed',
    'account',
    p_target_auth_user_id,
    jsonb_build_object(
      'prior_shift_code', prior_shift_code,
      'new_shift_code', p_new_shift_code
    )
  );
end;
$$;

comment on function app_private.change_account_shift(uuid, uuid, text) is
  'Changes one active same-facility staff shift, revokes existing sessions, and records bounded audit metadata.';

revoke all on function app_private.change_account_shift(uuid, uuid, text)
  from public, anon, authenticated, service_role;

commit;
