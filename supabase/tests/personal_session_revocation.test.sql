begin;

select plan(14);

select lives_ok(
  $$
    insert into auth.users (id, email)
    values ('aaaaaaaa-0000-4000-8000-000000000051', 'session-revocation@example.invalid');
    select app_private.bootstrap_first_administrator(
      'aaaaaaaa-0000-4000-8000-000000000051', repeat('a', 64), '0051',
      'Fictional Session User', 'session-revocation-alias@example.invalid',
      statement_timestamp() + interval '30 minutes'
    );
    select app_private.activate_bootstrapped_administrator('aaaaaaaa-0000-4000-8000-000000000051');
    select app_private.complete_temporary_passcode_change(
      'aaaaaaaa-0000-4000-8000-000000000051', repeat('a', 64)
    );
  $$,
  'a fictional active account exists for session revocation checks'
);

select is(
  app_private.revoke_personal_sessions(
    'aaaaaaaa-0000-4000-8000-000000000051', 3, 'requested'
  ),
  4,
  'account-wide revocation returns the advanced session generation'
);

select is(
  (select auth_version from app_private.user_accounts
   where auth_user_id = 'aaaaaaaa-0000-4000-8000-000000000051'),
  4,
  'account-wide revocation invalidates already-issued access tokens'
);

select is(
  app_private.custom_access_token_hook(
    jsonb_build_object(
      'user_id', 'aaaaaaaa-0000-4000-8000-000000000051',
      'claims', jsonb_build_object('app_metadata', '{}'::jsonb)
    )
  ) #>> '{claims,app_metadata,auth_version}',
  '0',
  'a token refreshed during the provider call receives no application authority'
);

select is(
  (select metadata from app_private.audit_events
   where event_type = 'account.sessions.revoked'
     and target_id = 'aaaaaaaa-0000-4000-8000-000000000051'
   order by occurred_at desc, id desc limit 1),
  '{"outcome":"requested","scope":"global"}'::jsonb,
  'the revocation audit contains only bounded metadata'
);

select is(
  app_private.revoke_personal_sessions(
    'aaaaaaaa-0000-4000-8000-000000000051', 4, 'completed'
  ),
  5,
  'provider completion seals the intermediate session generation'
);

select is(
  (select auth_version from app_private.user_accounts
   where auth_user_id = 'aaaaaaaa-0000-4000-8000-000000000051'),
  5,
  'a token refreshed during provider sign-out is stale after completion'
);

select is(
  app_private.custom_access_token_hook(
    jsonb_build_object(
      'user_id', 'aaaaaaaa-0000-4000-8000-000000000051',
      'claims', jsonb_build_object('app_metadata', '{}'::jsonb)
    )
  ) #>> '{claims,app_metadata,auth_version}',
  '5',
  'successful completion restores current authority for a fresh sign-in'
);

select is(
  (select metadata from app_private.audit_events
   where event_type = 'account.sessions.revoked'
     and target_id = 'aaaaaaaa-0000-4000-8000-000000000051'
   order by occurred_at desc, id desc limit 1),
  '{"outcome":"completed","scope":"global"}'::jsonb,
  'provider completion records a separate bounded audit outcome'
);

select throws_ok(
  $$ select app_private.revoke_personal_sessions(
    'aaaaaaaa-0000-4000-8000-000000000051', 5, 'unexpected'
  ) $$,
  'P0001',
  'Valid session revocation phase is required',
  'the database refuses an unbounded audit phase'
);

select throws_ok(
  $$ select app_private.revoke_personal_sessions(
    'aaaaaaaa-0000-4000-8000-000000000051', 4, 'completed'
  ) $$,
  '40001',
  'Session authority changed',
  'a stale session cannot revoke against a newer account generation'
);

select is(
  (select auth_version from app_private.user_accounts
   where auth_user_id = 'aaaaaaaa-0000-4000-8000-000000000051'),
  5,
  'a stale retry does not advance the session generation again'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'app_private.revoke_personal_sessions(uuid, integer, text)',
    'execute'
  )
  and not has_function_privilege(
    'anon',
    'app_private.revoke_personal_sessions(uuid, integer, text)',
    'execute'
  ),
  'browser roles cannot invoke private session revocation'
);

select ok(
  not has_function_privilege(
    'service_role',
    'app_private.revoke_personal_sessions(uuid, integer, text)',
    'execute'
  ),
  'the generic elevated Data API role cannot invoke private session revocation'
);

select * from finish();
rollback;
