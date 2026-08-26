begin;

select plan(16);

select lives_ok(
  $$
    insert into auth.users (id, email)
    values (
      'aaaaaaaa-0000-4000-8000-000000000001',
      'first-admin-fixture@example.invalid'
    );

    select app_private.bootstrap_first_administrator(
      'aaaaaaaa-0000-4000-8000-000000000001',
      repeat('a', 64),
      '01',
      'Fictional First Administrator',
      'first-admin-auth-alias@example.invalid',
      statement_timestamp() + interval '30 minutes'
    );
  $$,
  'zero-account bootstrap creates a fictional pending administrator'
);

select is(
  (
    select status::text
    from app_private.user_accounts
    where auth_user_id = 'aaaaaaaa-0000-4000-8000-000000000001'
  ),
  'pending',
  'bootstrap account remains pending until private delivery is confirmed'
);

select ok(
  (
    select must_change_passcode
      and temporary_passcode_expires_at > statement_timestamp()
    from app_private.user_accounts
    where auth_user_id = 'aaaaaaaa-0000-4000-8000-000000000001'
  ),
  'a bootstrap account has a forced, time-limited temporary passcode'
);

select is(
  (
    select metadata->>'outcome'
    from app_private.audit_events
    where event_type = 'account.bootstrap.pending'
      and target_id = 'aaaaaaaa-0000-4000-8000-000000000001'
  ),
  'awaiting_private_delivery',
  'pending bootstrap audit metadata contains only the allowlisted outcome'
);

select throws_ok(
  $$
    select app_private.bootstrap_first_administrator(
      'aaaaaaaa-0000-4000-8000-000000000001',
      repeat('b', 64),
      '02',
      'Second fictional administrator',
      'second-auth-alias@example.invalid',
      statement_timestamp() + interval '30 minutes'
    );
  $$,
  'First administrator bootstrap is no longer available',
  'zero-account bootstrap rejects a second attempt'
);

select lives_ok(
  $$
    select app_private.activate_bootstrapped_administrator(
      'aaaaaaaa-0000-4000-8000-000000000001'
    );
  $$,
  'private-delivery confirmation can activate the pending administrator'
);

select is(
  (
    select status::text
    from app_private.user_accounts
    where auth_user_id = 'aaaaaaaa-0000-4000-8000-000000000001'
  ),
  'active',
  'only delivery confirmation makes the first administrator sign-in capable'
);

select is(
  (
    select metadata->>'outcome'
    from app_private.audit_events
    where event_type = 'account.bootstrap.activated'
      and target_id = 'aaaaaaaa-0000-4000-8000-000000000001'
  ),
  'private_delivery_confirmed',
  'activation audit metadata does not store a credential or employee number'
);

select lives_ok(
  $$
    insert into auth.users (id, email)
    values (
      'aaaaaaaa-0000-4000-8000-000000000002',
      'expiry-fixture@example.invalid'
    );

    delete from app_private.user_accounts;
    delete from app_private.staff_members;

    select app_private.bootstrap_first_administrator(
      'aaaaaaaa-0000-4000-8000-000000000002',
      repeat('c', 64),
      '02',
      'Fictional Expired Administrator',
      'expired-auth-alias@example.invalid',
      statement_timestamp() + interval '1 second'
    );
  $$,
  'a separate fictional pending bootstrap can be staged for expiry checks'
);

select lives_ok(
  $$
    update app_private.user_accounts
      set temporary_passcode_expires_at = statement_timestamp() - interval '1 second'
      where auth_user_id = 'aaaaaaaa-0000-4000-8000-000000000002';
  $$,
  'a fictional temporary passcode can be deterministically expired for a negative test'
);

select throws_ok(
  $$
    select app_private.activate_bootstrapped_administrator(
      'aaaaaaaa-0000-4000-8000-000000000002'
    );
  $$,
  'query returned no rows',
  'activation rejects an already-expired temporary passcode'
);

select lives_ok(
  $$
    select app_private.abandon_bootstrapped_administrator(
      'aaaaaaaa-0000-4000-8000-000000000002'
    );
  $$,
  'a failed private delivery can abandon the pending bootstrap'
);

select is(
  (
    select count(*)::integer
    from app_private.user_accounts
    where auth_user_id = 'aaaaaaaa-0000-4000-8000-000000000002'
  ),
  0,
  'abandon removes the sign-in-ineligible pending application account'
);

select is(
  (
    select count(*)::integer
    from app_private.staff_members
    where employee_lookup_hash = repeat('c', 64)
  ),
  0,
  'abandon removes the pending fictional staff record'
);

select is(
  (
    select metadata->>'outcome'
    from app_private.audit_events
    where event_type = 'account.bootstrap.abandoned'
      and target_id = 'aaaaaaaa-0000-4000-8000-000000000002'
  ),
  'private_delivery_failed',
  'abandon audit metadata records no credential or raw identity'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'app_private.bootstrap_first_administrator(uuid, text, text, text, text, timestamptz)',
    'execute'
  )
  and not has_function_privilege(
    'anon',
    'app_private.activate_bootstrapped_administrator(uuid)',
    'execute'
  )
  and not has_function_privilege(
    'service_role',
    'app_private.abandon_bootstrapped_administrator(uuid)',
    'execute'
  ),
  'Data API roles cannot call private bootstrap functions'
);

select * from finish();
rollback;
