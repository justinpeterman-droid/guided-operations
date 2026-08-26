begin;

select plan(7);

select lives_ok(
  $$
    insert into auth.users (id, email)
    values
      ('aaaaaaaa-0000-4000-8000-000000000021', 'reset-admin@example.invalid'),
      ('aaaaaaaa-0000-4000-8000-000000000022', 'reset-officer@example.invalid');

    select app_private.bootstrap_first_administrator(
      'aaaaaaaa-0000-4000-8000-000000000021',
      repeat('a', 64), '0021', 'Fictional Reset Administrator',
      'reset-admin-alias@example.invalid', statement_timestamp() + interval '30 minutes'
    );
    select app_private.activate_bootstrapped_administrator('aaaaaaaa-0000-4000-8000-000000000021');
    select app_private.complete_temporary_passcode_change('aaaaaaaa-0000-4000-8000-000000000021', repeat('a', 64));

    insert into app_private.staff_members(facility_id, employee_lookup_hash, employee_number_hint, display_name, status)
    select id, repeat('b', 64), '0022', 'Fictional Reset Officer', 'active'
    from app_private.facilities where singleton_key = 1;
    insert into app_private.user_accounts(auth_user_id, staff_member_id, sign_in_alias, role, status, must_change_passcode)
    select 'aaaaaaaa-0000-4000-8000-000000000022', id, 'reset-officer-alias@example.invalid', 'officer', 'active', false
    from app_private.staff_members where employee_lookup_hash = repeat('b', 64);
  $$,
  'fictional active administrator and officer exist for reset checks'
);

select lives_ok(
  $$ select app_private.prepare_account_passcode_reset(
    'aaaaaaaa-0000-4000-8000-000000000021',
    'aaaaaaaa-0000-4000-8000-000000000022',
    statement_timestamp() + interval '30 minutes'
  ) $$,
  'an active same-facility administrator can prepare a reset'
);

select ok(
  (select must_change_passcode and temporary_passcode_expires_at > statement_timestamp()
   from app_private.user_accounts where auth_user_id = 'aaaaaaaa-0000-4000-8000-000000000022'),
  'prepared reset requires a time-limited passcode change'
);

select is(
  (select metadata->>'outcome' from app_private.audit_events
   where event_type = 'account.passcode.reset.prepared'
     and target_id = 'aaaaaaaa-0000-4000-8000-000000000022'),
  'awaiting_in_person_delivery',
  'reset audit holds only its allowlisted outcome'
);

select throws_ok(
  $$ select app_private.prepare_account_passcode_reset(
    'aaaaaaaa-0000-4000-8000-000000000021',
    'aaaaaaaa-0000-4000-8000-000000000021',
    statement_timestamp() + interval '30 minutes'
  ) $$,
  'An administrator cannot reset their own account through this ceremony',
  'the reset ceremony rejects self-reset'
);

select throws_ok(
  $$ select app_private.prepare_account_passcode_reset(
    'aaaaaaaa-0000-4000-8000-000000000021',
    'aaaaaaaa-0000-4000-8000-000000000022',
    statement_timestamp() + interval '2 hours'
  ) $$,
  'Invalid temporary passcode expiry',
  'the reset ceremony rejects an excessive temporary duration'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'app_private.prepare_account_passcode_reset(uuid, uuid, timestamptz)',
    'execute'
  ),
  'Data API roles cannot call private passcode-reset preparation'
);

select * from finish();
rollback;
