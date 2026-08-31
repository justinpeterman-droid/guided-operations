begin;

select plan(10);

select ok(
  exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260831110000'
  ),
  'answer-report hardening is delivered by a forward migration'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'answer_reports_citations_payload_bounded'
      and conrelid = 'app_private.answer_reports'::regclass
  ),
  'the database bounds serialized citation payloads'
);

select ok(
  has_function_privilege(
    'authenticated',
    'api.report_policy_answer(text,text,jsonb,text)',
    'execute'
  )
  and not has_function_privilege(
    'anon',
    'api.report_policy_answer(text,text,jsonb,text)',
    'execute'
  )
  and not has_function_privilege(
    'service_role',
    'api.report_policy_answer(text,text,jsonb,text)',
    'execute'
  ),
  'only authenticated sessions can submit answer reports'
);

select ok(
  position(
    'pg_advisory_xact_lock' in
    pg_get_functiondef(
      'api.report_policy_answer(text,text,jsonb,text)'::regprocedure
    )
  ) > 0,
  'the rolling quota is serialized per account'
);

select ok(
  position(
    '>= 30' in
    pg_get_functiondef(
      'api.report_policy_answer(text,text,jsonb,text)'::regprocedure
    )
  ) > 0,
  'the database function enforces the documented hourly ceiling'
);

select lives_ok(
  $$
    insert into auth.users (id, email) values
      ('71000000-0000-4000-8000-000000000011', 'answer-one@invalid.example'),
      ('71000000-0000-4000-8000-000000000012', 'answer-two@invalid.example');

    insert into app_private.staff_members (
      id, facility_id, employee_lookup_hash, employee_number_hint,
      display_name, status
    )
    select
      '71000000-0000-4000-8000-000000000021',
      facility.id,
      repeat('1', 64),
      'FICT-AR1',
      'Fictional Answer Reporter One',
      'active'
    from app_private.facilities as facility
    limit 1;

    insert into app_private.staff_members (
      id, facility_id, employee_lookup_hash, employee_number_hint,
      display_name, status
    )
    select
      '71000000-0000-4000-8000-000000000022',
      facility.id,
      repeat('2', 64),
      'FICT-AR2',
      'Fictional Answer Reporter Two',
      'active'
    from app_private.facilities as facility
    limit 1;

    insert into app_private.user_accounts (
      auth_user_id, staff_member_id, sign_in_alias, role, status,
      must_change_passcode, auth_version
    ) values
      (
        '71000000-0000-4000-8000-000000000011',
        '71000000-0000-4000-8000-000000000021',
        'answer-one@accounts.invalid',
        'officer',
        'active',
        false,
        3
      ),
      (
        '71000000-0000-4000-8000-000000000012',
        '71000000-0000-4000-8000-000000000022',
        'answer-two@accounts.invalid',
        'officer',
        'active',
        false,
        4
      );
  $$,
  'fictional active accounts can exercise the answer-report boundary'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '71000000-0000-4000-8000-000000000011',
  true
);
select set_config(
  'request.jwt.claims',
  '{"app_metadata":{"auth_version":3}}',
  true
);

select lives_ok(
  $$
    select api.report_policy_answer(
      'Was the shown answer correct?',
      'The answer displayed to the fictional officer.',
      '[]'::jsonb,
      'fictional-corpus-v1'
    )
  $$,
  'a valid report below the quota is recorded'
);

select is(
  (
    select count(*)::integer
    from app_private.answer_reports
    where reported_by_account_id =
      '71000000-0000-4000-8000-000000000011'
  ),
  1,
  'the accepted report is persisted once'
);

reset role;

insert into app_private.answer_reports (
  facility_id,
  reported_by_account_id,
  question,
  answer_text,
  citations
)
select
  facility.id,
  '71000000-0000-4000-8000-000000000011',
  'Fictional quota seed ' || series.value,
  'Fictional answer',
  '[]'::jsonb
from app_private.facilities as facility
cross join generate_series(1, 29) as series(value)
limit 29;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '71000000-0000-4000-8000-000000000011',
  true
);
select set_config(
  'request.jwt.claims',
  '{"app_metadata":{"auth_version":3}}',
  true
);

select throws_ok(
  $$
    select api.report_policy_answer(
      'Can another report be stored?',
      'No.',
      '[]'::jsonb,
      'fictional-corpus-v1'
    )
  $$,
  '54000',
  'Answer report limit reached',
  'the thirtieth recent row closes the atomic rolling quota'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '71000000-0000-4000-8000-000000000012',
  true
);
select set_config(
  'request.jwt.claims',
  '{"app_metadata":{"auth_version":4}}',
  true
);

select throws_ok(
  $$
    select api.report_policy_answer(
      'Can an oversized citation be stored?',
      'No.',
      jsonb_build_array(
        jsonb_build_object('excerpt', repeat('x', 33000))
      ),
      'fictional-corpus-v1'
    )
  $$,
  '22023',
  'Citations payload is too large',
  'direct RPC callers cannot bypass the citation byte ceiling'
);

select * from finish();
rollback;
