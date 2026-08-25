begin;

create or replace function app_private.enforce_user_account_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  linked_staff_status app_private.staff_status;
  state_or_role_changed boolean := false;
begin
  if new.status = 'active' then
    select staff.status
      into strict linked_staff_status
      from app_private.staff_members as staff
      where staff.id = new.staff_member_id;

    if linked_staff_status <> 'active' then
      raise exception 'An active account requires an active staff member';
    end if;
  end if;

  if new.status = 'locked'
    and (new.locked_until is null or new.locked_until <= statement_timestamp()) then
    raise exception 'A locked account requires a future locked_until timestamp';
  end if;

  if new.status <> 'locked' and new.locked_until is not null then
    raise exception 'Only a locked account may have locked_until set';
  end if;

  if tg_op = 'UPDATE' then
    state_or_role_changed := new.role is distinct from old.role
      or new.status is distinct from old.status
      or new.must_change_passcode is distinct from old.must_change_passcode;

    if old.role = 'administrator'
      and old.status = 'active'
      and (new.role <> 'administrator' or new.status <> 'active')
      and not exists (
        select 1
        from app_private.user_accounts as account
        where account.auth_user_id <> old.auth_user_id
          and account.role = 'administrator'
          and account.status = 'active'
      ) then
      raise exception 'Cannot remove the last active administrator';
    end if;

    if state_or_role_changed then
      new.auth_version := old.auth_version + 1;
    end if;
  end if;

  return new;
end;
$$;

comment on function app_private.enforce_user_account_lifecycle() is
  'Private trigger guard for account state, active-staff linkage, auth-version revocation, and last-admin protection.';

revoke all on function app_private.enforce_user_account_lifecycle()
  from public, anon, authenticated, service_role;

create trigger user_accounts_enforce_lifecycle
before insert or update on app_private.user_accounts
for each row execute function app_private.enforce_user_account_lifecycle();

commit;
