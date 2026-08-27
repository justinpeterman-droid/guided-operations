begin;

select plan(23);

select has_table('app_private', 'ai_request_budget_months', 'global AI counters exist');
select has_table('app_private', 'ai_request_budget_accounts', 'per-account AI counters exist');
select has_table('app_private', 'ai_request_budget_windows', 'short-window AI counters exist');
select has_table('app_private', 'ai_request_budget_leases', 'AI concurrency leases exist');
select ok(
  to_regprocedure(
    'app_private.reserve_ai_request_budget(uuid,text,integer,integer,integer,integer,integer,integer)'
  ) is not null
  and to_regprocedure('app_private.reserve_ai_request_budget(text,integer,integer)') is not null,
  'reservation requires an opaque authorized account ID'
);
select is(
  (
    select allowed
    from app_private.reserve_ai_request_budget('policy_answer', 100, 90)
  ),
  false,
  'the legacy identity-free signature remains compatible but fails closed'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'app_private.reserve_ai_request_budget(uuid,text,integer,integer,integer,integer,integer,integer)',
    'execute'
  )
  and not has_function_privilege(
    'service_role',
    'app_private.release_ai_request_budget_lease(uuid,uuid)',
    'execute'
  ),
  'Data API roles cannot reserve or release AI budget directly'
);
select is(
  (
    select count(*)::integer
    from information_schema.columns
    where table_schema = 'app_private'
      and table_name like 'ai_request_budget_%'
      and column_name in ('prompt', 'response', 'employee_number', 'display_name')
  ),
  0,
  'AI budget state contains no prompts, responses, or personnel fields'
);

select lives_ok(
  $$
    insert into auth.users (id, email) values
      ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'ai-one@example.invalid'),
      ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'ai-two@example.invalid');
    insert into app_private.staff_members (
      id, facility_id, employee_lookup_hash, employee_number_hint,
      display_name, status
    )
    select 'aaaaaaaa-0000-4000-8000-000000000001', facility.id,
      repeat('a', 64), 'A1', 'Fictional AI One', 'active'
    from app_private.facilities as facility limit 1;
    insert into app_private.staff_members (
      id, facility_id, employee_lookup_hash, employee_number_hint,
      display_name, status
    )
    select 'bbbbbbbb-0000-4000-8000-000000000002', facility.id,
      repeat('b', 64), 'B2', 'Fictional AI Two', 'active'
    from app_private.facilities as facility limit 1;
    insert into app_private.user_accounts (
      auth_user_id, staff_member_id, sign_in_alias, role, status,
      must_change_passcode
    ) values
      ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
       'aaaaaaaa-0000-4000-8000-000000000001',
       'ai-one-auth-alias@example.invalid', 'officer', 'active', false),
      ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
       'bbbbbbbb-0000-4000-8000-000000000002',
       'ai-two-auth-alias@example.invalid', 'officer', 'active', false);
  $$,
  'fictional active accounts can exercise the private limiter'
);

select is(
  (select allowed from app_private.reserve_ai_request_budget(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'policy_answer',
    100, 100, 20, 2, 1, 90
  )), true, 'the first authorized account request receives a lease'
);
select ok(
  (
    select expires_at > clock_timestamp() + interval '80 seconds'
    from app_private.ai_request_budget_leases
    where account_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  ),
  'the concurrency lease receives a fresh post-contention lifetime'
);
select is(
  (select reason_code from app_private.reserve_ai_request_budget(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'policy_answer',
    100, 100, 20, 2, 1, 90
  )), 'account_concurrency_limited',
  'a second concurrent request from one account is denied'
);
select is(
  (select request_count from app_private.ai_request_budget_months
   where period_start = date_trunc('month', statement_timestamp() at time zone 'UTC')::date),
  1,
  'a denied concurrency attempt does not consume the shared budget'
);
select is(
  app_private.release_ai_request_budget_lease(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    (select id from app_private.ai_request_budget_leases
     where account_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
  ), true, 'the account can release its exact concurrency lease'
);
select is(
  (select allowed from app_private.reserve_ai_request_budget(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'policy_answer',
    100, 100, 20, 2, 1, 90
  )), true, 'a released lease permits the account next request'
);
delete from app_private.ai_request_budget_leases
where account_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
select is(
  (select reason_code from app_private.reserve_ai_request_budget(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'policy_answer',
    100, 100, 20, 2, 1, 90
  )), 'account_rate_limited',
  'the same account cannot exceed its short-window rate'
);
select is(
  (select allowed from app_private.reserve_ai_request_budget(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'policy_answer',
    100, 100, 20, 2, 1, 90
  )), true, 'one account rate limit does not block a different account'
);

update app_private.ai_request_budget_leases
set expires_at = statement_timestamp() - interval '1 second'
where account_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
update app_private.ai_request_budget_windows
set window_started_at = statement_timestamp() - interval '2 minutes'
where account_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
select is(
  (select allowed from app_private.reserve_ai_request_budget(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'report_draft',
    100, 100, 20, 2, 1, 90
  )), true, 'an expired lease recovers without manual intervention'
);

delete from app_private.ai_request_budget_leases;
update app_private.ai_request_budget_windows
set window_started_at = statement_timestamp() - interval '2 minutes';
select is(
  (select reason_code from app_private.reserve_ai_request_budget(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'report_draft',
    10, 100, 10, 10, 2, 90
  )), 'account_monthly_limited',
  'a small monthly fair share prevents one account from exhausting the total'
);

update app_private.ai_request_budget_months
set request_count = 10,
    policy_answer_request_count = 10,
    report_draft_request_count = 0;
delete from app_private.ai_request_budget_accounts
where account_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
select is(
  (select reason_code from app_private.reserve_ai_request_budget(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'report_draft',
    10, 100, 20, 10, 2, 90
  )), 'budget_exhausted', 'the shared monthly stop remains authoritative'
);

select throws_ok(
  $$ select * from app_private.reserve_ai_request_budget(
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'policy_answer',
    100, 90, 5, 6, 2, 90
  ) $$,
  'Invalid AI budget account',
  'an unknown account cannot reserve provider capacity'
);

select throws_ok(
  $$ select * from app_private.reserve_ai_request_budget(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'unknown',
    100, 90, 5, 6, 2, 90
  ) $$,
  'Invalid AI budget operation',
  'unknown AI operations fail closed'
);

select throws_ok(
  $$ select * from app_private.reserve_ai_request_budget(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'policy_answer',
    1, 100, 5, 6, 2, 90
  ) $$,
  'AI global budget is too small for per-account isolation',
  'configuration cannot let one account equal the entire global budget'
);

select * from finish();
rollback;
