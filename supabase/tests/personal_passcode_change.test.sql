begin;

select plan(12);

select lives_ok(
  $$
    insert into auth.users (id, email)
    values ('aaaaaaaa-0000-4000-8000-000000000041', 'personal-passcode@example.invalid');
    select app_private.bootstrap_first_administrator(
      'aaaaaaaa-0000-4000-8000-000000000041', repeat('e', 64), '0041',
      'Fictional Passcode User', 'personal-passcode-alias@example.invalid',
      statement_timestamp() + interval '30 minutes'
    );
    select app_private.activate_bootstrapped_administrator('aaaaaaaa-0000-4000-8000-000000000041');
    select app_private.complete_temporary_passcode_change(
      'aaaaaaaa-0000-4000-8000-000000000041', repeat('e', 64)
    );
  $$,
  'a fictional active account exists for personal passcode checks'
);

select ok(
  app_private.verify_personal_passcode_identity(
    'aaaaaaaa-0000-4000-8000-000000000041', repeat('e', 64)
  ),
  'the matching active account identity is accepted'
);

select ok(
  not app_private.verify_personal_passcode_identity(
    'aaaaaaaa-0000-4000-8000-000000000041', repeat('f', 64)
  ),
  'a mismatched keyed employee identity is rejected'
);

select lives_ok(
  $$ select app_private.prepare_personal_passcode_change(
    'aaaaaaaa-0000-4000-8000-000000000041', repeat('e', 64)
  ) $$,
  'the matching account can prepare a personal passcode change'
);

select is(
  (select auth_version from app_private.user_accounts
   where auth_user_id = 'aaaaaaaa-0000-4000-8000-000000000041'),
  4,
  'preparation advances auth_version before the provider update'
);

select is(
  (select metadata->>'outcome' from app_private.audit_events
   where event_type = 'account.passcode.change.prepared'
     and target_id = 'aaaaaaaa-0000-4000-8000-000000000041'),
  'provider_update_pending',
  'the preparation audit records only a bounded pending outcome'
);

select lives_ok(
  $$ select app_private.record_personal_passcode_change(
    'aaaaaaaa-0000-4000-8000-000000000041', repeat('e', 64)
  ) $$,
  'the matching account can record provider completion'
);

select is(
  (select auth_version from app_private.user_accounts
   where auth_user_id = 'aaaaaaaa-0000-4000-8000-000000000041'),
  4,
  'completion does not create a second session-version change'
);

select is(
  (select metadata->>'outcome' from app_private.audit_events
   where event_type = 'account.passcode.changed'
     and target_id = 'aaaaaaaa-0000-4000-8000-000000000041'
   order by occurred_at desc, id desc limit 1),
  'personal_passcode_replaced',
  'the audit contains only the bounded passcode-change outcome'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'app_private.verify_personal_passcode_identity(uuid, text)',
    'execute'
  ),
  'Data API roles cannot call the private identity check'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'app_private.prepare_personal_passcode_change(uuid, text)',
    'execute'
  ),
  'Data API roles cannot prepare personal passcode changes'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'app_private.record_personal_passcode_change(uuid, text)',
    'execute'
  ),
  'Data API roles cannot record personal passcode changes'
);

select * from finish();
rollback;
