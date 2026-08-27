begin;

select plan(12);

select has_table(
  'app_private', 'ai_request_budget_months',
  'private monthly AI request counters exist'
);
select ok(
  to_regprocedure(
    'app_private.reserve_ai_request_budget(text,integer,integer)'
  ) is not null,
  'atomic AI request reservation exists'
);
select ok(
  (
    select relation.relrowsecurity and relation.relforcerowsecurity
    from pg_class as relation
    where relation.oid = 'app_private.ai_request_budget_months'::regclass
  ),
  'AI request counters force row-level security'
);
select ok(
  not has_table_privilege(
    'authenticated', 'app_private.ai_request_budget_months', 'select'
  )
    and not has_table_privilege(
      'service_role', 'app_private.ai_request_budget_months', 'select'
    ),
  'Data API roles cannot read AI budget counters'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'app_private.reserve_ai_request_budget(text,integer,integer)',
    'execute'
  )
    and not has_function_privilege(
      'service_role',
      'app_private.reserve_ai_request_budget(text,integer,integer)',
      'execute'
    ),
  'Data API roles cannot reserve AI budget directly'
);

select is(
  (
    select allowed
    from app_private.reserve_ai_request_budget('policy_answer', 10, 90)
  ),
  true,
  'a policy answer reserves the first request slot'
);

select lives_ok(
  $$
    select app_private.reserve_ai_request_budget('policy_answer', 10, 90)
    from generate_series(1, 7)
  $$,
  'additional requests can reserve up to the stop threshold'
);

select is(
  (
    select allowed
    from app_private.reserve_ai_request_budget('report_draft', 10, 90)
  ),
  true,
  'the ninth request is allowed at the ninety-percent threshold'
);

select is(
  (
    select allowed
    from app_private.reserve_ai_request_budget('report_draft', 10, 90)
  ),
  false,
  'the next request is denied after the threshold is reserved'
);

select is(
  (
    select request_count
    from app_private.ai_request_budget_months
    where period_start = date_trunc(
      'month', statement_timestamp() at time zone 'UTC'
    )::date
  ),
  9,
  'a denied request does not consume another budget slot'
);

select throws_ok(
  $$ select * from app_private.reserve_ai_request_budget('unknown', 10, 90) $$,
  'Invalid AI budget operation',
  'unknown AI operations fail closed'
);

select throws_ok(
  $$ select * from app_private.reserve_ai_request_budget('policy_answer', 0, 90) $$,
  'Invalid AI monthly request cap',
  'an invalid monthly cap fails closed'
);

select * from finish();
rollback;
