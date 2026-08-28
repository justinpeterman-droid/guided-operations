begin;

select plan(18);

select has_table(
  'app_private',
  'daily_paperwork_template_packages',
  'the private six-definition package registry exists'
);

select ok(
  (
    select relrowsecurity and relforcerowsecurity
    from pg_class
    where oid = 'app_private.daily_paperwork_template_packages'::regclass
  ),
  'the package registry enables and forces RLS'
);

select ok(
  not has_table_privilege(
    'authenticated',
    'app_private.daily_paperwork_template_packages',
    'select,insert,update,delete'
  )
  and not has_table_privilege(
    'service_role',
    'app_private.daily_paperwork_template_packages',
    'select,insert,update,delete'
  ),
  'browser and elevated Data API roles cannot use the private package table'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'app_private.register_daily_paperwork_template_package(uuid,uuid,integer,text,uuid,text,text,text,text,date,text,text,text,jsonb)',
    'execute'
  )
  and not has_function_privilege(
    'service_role',
    'app_private.register_daily_paperwork_template_package(uuid,uuid,integer,text,uuid,text,text,text,text,date,text,text,text,jsonb)',
    'execute'
  ),
  'browser and elevated Data API roles cannot execute package registration'
);

insert into auth.users (id, email)
values (
  '81000000-0000-4000-8000-000000000001',
  'fictional-package-admin@example.invalid'
);

insert into app_private.staff_members (
  id,
  facility_id,
  employee_lookup_hash,
  employee_number_hint,
  display_name,
  status,
  shift_code
)
select
  '82000000-0000-4000-8000-000000000001',
  facility.id,
  repeat('8', 64),
  'FP1',
  'Fictional Package Administrator',
  'active',
  'A'
from app_private.facilities as facility;

insert into app_private.user_accounts (
  auth_user_id,
  staff_member_id,
  sign_in_alias,
  role,
  status,
  must_change_passcode
)
values (
  '81000000-0000-4000-8000-000000000001',
  '82000000-0000-4000-8000-000000000001',
  'fictional-package-admin-auth@example.invalid',
  'administrator',
  'active',
  false
);

create temporary table test_daily_paperwork_package (entries jsonb not null);

insert into test_daily_paperwork_package(entries)
select jsonb_agg(
  jsonb_build_object(
    'kind', fixture.kind,
    'title', fixture.title,
    'source_byte_length', 100,
    'source_sha256', repeat('e', 64),
    'mapped_sha256', repeat('f', 64),
    'print_orientation', 'portrait',
    'structure', jsonb_build_object(
      'schema_version', 1,
      'mapping_version', 'daily-paperwork-source-to-form-v1',
      'source_kind', fixture.kind,
      'source_definition', jsonb_build_object('fictional', true)
    ),
    'field_schema', jsonb_build_object(
      'schema_version', 1,
      'fields', jsonb_build_array(jsonb_build_object(
        'key', 'fictional_note',
        'label', 'Fictional note',
        'required', false,
        'type', 'text',
        'max_length', 200
      )),
      'tables', '[]'::jsonb
    )
  ) order by fixture.position
)
from (
  values
    (1, 'assignment_roster', 'Fictional Assignment Roster'),
    (2, 'uniform_inspection', 'Fictional Uniform Inspection'),
    (3, 'metal_detector_test', 'Fictional Detector Test'),
    (4, 'perimeter_check', 'Fictional Perimeter Check'),
    (5, 'random_search_log', 'Fictional Search Log'),
    (6, 'detector_sign_out', 'Fictional Detector Sign-Out')
) as fixture(position, kind, title);

select app_private.issue_admin_step_up(
  '81000000-0000-4000-8000-000000000001',
  '83000000-0000-4000-8000-000000000001',
  1,
  'paperwork.template_import',
  repeat('A', 43),
  '84000000-0000-4000-8000-000000000001',
  statement_timestamp() + interval '5 minutes'
);

select is(
  app_private.bind_admin_step_up_target(
    '81000000-0000-4000-8000-000000000001',
    '83000000-0000-4000-8000-000000000001',
    1,
    'paperwork.template_import',
    '84000000-0000-4000-8000-000000000001',
    repeat('a', 64)
  ),
  true,
  'the one-time import proof binds to the exact reviewed package digest'
);

select lives_ok(
  $$
    select app_private.register_daily_paperwork_template_package(
      '81000000-0000-4000-8000-000000000001',
      '83000000-0000-4000-8000-000000000001',
      1,
      repeat('A', 43),
      '84000000-0000-4000-8000-000000000001',
      repeat('a', 64),
      'daily-paperwork-source-to-form-v1',
      'Fictional Records Owner',
      'FICTIONAL-PACKAGE-V1',
      date '2026-09-01',
      null,
      null,
      repeat('d', 64),
      (select entries from test_daily_paperwork_package)
    )
  $$,
  'one matching proof atomically registers the complete package'
);

select is(
  (
    select count(*)::integer
    from app_private.daily_paperwork_template_packages
  ),
  1,
  'one value-free package manifest is appended'
);

select is(
  (
    select count(*)::integer
    from app_private.form_templates
    where package_id is not null
  ),
  6,
  'all six linked template versions are appended together'
);

select ok(
  (
    select consumed_at is not null and target_digest = repeat('a', 64)
    from app_private.admin_step_ups
    where request_id = '84000000-0000-4000-8000-000000000001'
  ),
  'the digest-bound proof is consumed by the registration transaction'
);

select lives_ok(
  $$
    select app_private.register_daily_paperwork_template_package(
      '81000000-0000-4000-8000-000000000001',
      '83000000-0000-4000-8000-000000000001',
      1,
      repeat('A', 43),
      '84000000-0000-4000-8000-000000000001',
      repeat('a', 64),
      'daily-paperwork-source-to-form-v1',
      'Fictional Records Owner',
      'FICTIONAL-PACKAGE-V1',
      date '2026-09-01',
      null,
      null,
      repeat('d', 64),
      (select entries from test_daily_paperwork_package)
    )
  $$,
  'an exact retry returns the existing package without reusing the proof'
);

select is(
  (
    select count(*)::integer
    from app_private.form_templates
    where package_id is not null
  ),
  6,
  'the exact retry cannot append duplicate template versions'
);

select app_private.issue_admin_step_up(
  '81000000-0000-4000-8000-000000000001',
  '83000000-0000-4000-8000-000000000001',
  1,
  'paperwork.template_rollback',
  repeat('B', 43),
  '84000000-0000-4000-8000-000000000002',
  statement_timestamp() + interval '5 minutes'
);

select is(
  app_private.bind_admin_step_up_target(
    '81000000-0000-4000-8000-000000000001',
    '83000000-0000-4000-8000-000000000001',
    1,
    'paperwork.template_rollback',
    '84000000-0000-4000-8000-000000000002',
    repeat('b', 64)
  ),
  true,
  'the rollback proof binds to the exact reviewed rollback package digest'
);

select throws_ok(
  $$
    select app_private.register_daily_paperwork_template_package(
      '81000000-0000-4000-8000-000000000001',
      '83000000-0000-4000-8000-000000000001',
      1,
      repeat('B', 43),
      '84000000-0000-4000-8000-000000000002',
      repeat('b', 64),
      'daily-paperwork-source-to-form-v1',
      'Fictional Records Owner',
      'FICTIONAL-PACKAGE-ROLLBACK',
      date '2026-09-02',
      repeat('a', 64),
      repeat('a', 64),
      repeat('c', 64),
      jsonb_set(
        (select entries from test_daily_paperwork_package),
        '{0,mapped_sha256}',
        to_jsonb(repeat('0', 64))
      )
    )
  $$,
  '22023',
  'Daily Paperwork rollback entries do not match the approved package',
  'rollback rejects definitions that differ from the referenced package'
);

select ok(
  (select count(*) = 1 from app_private.daily_paperwork_template_packages)
  and (
    select count(*) = 6
    from app_private.form_templates
    where package_id is not null
  ),
  'a rejected rollback leaves the package and all six templates unchanged'
);

select lives_ok(
  $$
    select app_private.register_daily_paperwork_template_package(
      '81000000-0000-4000-8000-000000000001',
      '83000000-0000-4000-8000-000000000001',
      1,
      repeat('B', 43),
      '84000000-0000-4000-8000-000000000002',
      repeat('b', 64),
      'daily-paperwork-source-to-form-v1',
      'Fictional Records Owner',
      'FICTIONAL-PACKAGE-ROLLBACK',
      date '2026-09-02',
      repeat('a', 64),
      repeat('a', 64),
      repeat('c', 64),
      (select entries from test_daily_paperwork_package)
    )
  $$,
  'an exact rollback appends the previously approved six definitions'
);

select is(
  (select count(*)::integer from app_private.daily_paperwork_template_packages),
  2,
  'the exact rollback appends one new package manifest'
);

select is(
  (
    select count(*)::integer
    from app_private.form_templates
    where package_id is not null
  ),
  12,
  'the exact rollback appends all six prior definitions as new versions'
);

select ok(
  (
    select rollback_of_package_id is not null
    from app_private.daily_paperwork_template_packages
    where package_digest = repeat('b', 64)
  ),
  'the rollback package preserves its immutable source-package relationship'
);

select * from finish();
rollback;
