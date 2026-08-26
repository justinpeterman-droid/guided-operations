begin;

select plan(6);

select lives_ok(
  $$
    insert into auth.users (id, email)
    values
      ('aaaaaaaa-0000-4000-8000-000000000031', 'role-admin@example.invalid'),
      ('aaaaaaaa-0000-4000-8000-000000000032', 'role-officer@example.invalid');
    select app_private.bootstrap_first_administrator(
      'aaaaaaaa-0000-4000-8000-000000000031', repeat('c', 64), '0031',
      'Fictional Role Administrator', 'role-admin-alias@example.invalid',
      statement_timestamp() + interval '30 minutes'
    );
    select app_private.activate_bootstrapped_administrator('aaaaaaaa-0000-4000-8000-000000000031');
    insert into app_private.staff_members(facility_id, employee_lookup_hash, employee_number_hint, display_name, status)
    select id, repeat('d', 64), '0032', 'Fictional Role Officer', 'active'
    from app_private.facilities where singleton_key = 1;
    insert into app_private.user_accounts(auth_user_id, staff_member_id, sign_in_alias, role, status, must_change_passcode)
    select 'aaaaaaaa-0000-4000-8000-000000000032', id, 'role-officer-alias@example.invalid', 'officer', 'active', false
    from app_private.staff_members where employee_lookup_hash = repeat('d', 64);
  $$,
  'fictional active administrator and officer exist for role checks'
);

select lives_ok(
  $$ select app_private.change_account_role(
    'aaaaaaaa-0000-4000-8000-000000000031',
    'aaaaaaaa-0000-4000-8000-000000000032',
    'administrator'
  ) $$,
  'an active same-facility administrator can promote an officer'
);

select is(
  (select role::text from app_private.user_accounts
   where auth_user_id = 'aaaaaaaa-0000-4000-8000-000000000032'),
  'administrator',
  'the target role changes'
);

select is(
  (select metadata->>'new_role' from app_private.audit_events
   where event_type = 'account.role.changed'
     and target_id = 'aaaaaaaa-0000-4000-8000-000000000032'),
  'administrator',
  'the audit records only bounded role metadata'
);

select throws_ok(
  $$ select app_private.change_account_role(
    'aaaaaaaa-0000-4000-8000-000000000031',
    'aaaaaaaa-0000-4000-8000-000000000031',
    'officer'
  ) $$,
  'An administrator cannot change their own role',
  'self-demotion is rejected'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'app_private.change_account_role(uuid, uuid, app_private.account_role)',
    'execute'
  ),
  'Data API roles cannot call private role changes'
);

select * from finish();
rollback;
