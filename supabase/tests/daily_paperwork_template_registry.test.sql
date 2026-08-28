begin;

select plan(26);

select has_table(
  'app_private',
  'form_templates',
  'the private operational form template registry exists'
);

select ok(
  (
    select relrowsecurity and relforcerowsecurity
    from pg_class
    where oid = 'app_private.form_templates'::regclass
  ),
  'the private form template registry enables and forces RLS'
);

select ok(
  exists (
    select 1
    from pg_trigger as table_trigger
    where table_trigger.tgrelid = 'app_private.form_templates'::regclass
      and table_trigger.tgname =
        'guided_operations_backup_freeze_' ||
        substr(md5('app_private.form_templates'), 1, 16)
      and table_trigger.tgenabled in ('O', 'A')
      and table_trigger.tgfoid =
        'app_private.require_no_production_backup_write_freeze()'::regprocedure
      and table_trigger.tgtype = 62
  ),
  'form template writes are covered by the protected Production backup freeze'
);

select ok(
  not has_table_privilege(
    'authenticated',
    'app_private.form_templates',
    'select,insert,update,delete'
  ),
  'authenticated callers cannot directly read or change private form templates'
);

select ok(
  has_function_privilege(
    'authenticated',
    'api.list_daily_paperwork_status_v2(date,text)',
    'execute'
  )
  and not has_function_privilege(
    'anon',
    'api.list_daily_paperwork_status_v2(date,text)',
    'execute'
  )
  and not has_function_privilege(
    'authenticated',
    'api.list_daily_paperwork_status(date,text)',
    'execute'
  ),
  'only authenticated callers can execute the session-bound Daily Paperwork catalog RPC'
);

select ok(
  has_function_privilege(
    'authenticated',
    'api.get_daily_paperwork_template_v2(uuid,date)',
    'execute'
  )
  and not has_function_privilege(
    'anon',
    'api.get_daily_paperwork_template_v2(uuid,date)',
    'execute'
  )
  and not has_function_privilege(
    'authenticated',
    'api.get_daily_paperwork_template(uuid,date)',
    'execute'
  ),
  'only authenticated callers can execute the session-bound private template reader RPC'
);

insert into auth.users (id, email)
values
  (
    '71000000-0000-4000-8000-000000000001',
    'fictional-daily-admin@example.invalid'
  ),
  (
    '71000000-0000-4000-8000-000000000002',
    'fictional-daily-officer@example.invalid'
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
  fixture.id,
  facility.id,
  fixture.employee_lookup_hash,
  fixture.employee_number_hint,
  fixture.display_name,
  'active',
  fixture.shift_code
from app_private.facilities as facility
cross join (
  values
    (
      '72000000-0000-4000-8000-000000000001'::uuid,
      repeat('a', 64),
      'DA1',
      'Fictional Daily Administrator',
      'A'
    ),
    (
      '72000000-0000-4000-8000-000000000002'::uuid,
      repeat('b', 64),
      'DO2',
      'Fictional Daily Officer',
      'B'
    )
) as fixture(
  id,
  employee_lookup_hash,
  employee_number_hint,
  display_name,
  shift_code
);

insert into app_private.user_accounts (
  auth_user_id,
  staff_member_id,
  sign_in_alias,
  role,
  status,
  must_change_passcode
)
values
  (
    '71000000-0000-4000-8000-000000000001',
    '72000000-0000-4000-8000-000000000001',
    'fictional-daily-admin-auth@example.invalid',
    'administrator',
    'active',
    false
  ),
  (
    '71000000-0000-4000-8000-000000000002',
    '72000000-0000-4000-8000-000000000002',
    'fictional-daily-officer-auth@example.invalid',
    'officer',
    'active',
    false
  );

insert into app_private.form_templates (
  id,
  facility_id,
  template_code,
  title,
  version,
  source_authority,
  source_revision,
  source_sha256,
  rights_status,
  print_orientation,
  capabilities,
  structure,
  field_schema,
  active_from,
  approved_at,
  approved_by_account_id
)
select
  '73000000-0000-4000-8000-000000000001',
  facility.id,
  'assignment_roster',
  'Fictional Training Assignment Roster',
  1,
  'Fictional Records Owner',
  'FICTIONAL-TRAINING-V1',
  repeat('c', 64),
  'approved_internal_use',
  'landscape',
  array['screen', 'print']::text[],
  '{"schema_version":1,"fictional_training_definition":true}'::jsonb,
  '{"schema_version":1,"fields":[{"key":"supervisor_note","label":"Fictional supervisor note","type":"text","required":false,"max_length":200}],"tables":[]}'::jsonb,
  date '2026-01-01',
  timestamptz '2026-01-01T00:00:00Z',
  '71000000-0000-4000-8000-000000000001'
from app_private.facilities as facility;

select is(
  (
    select count(*)::integer
    from api.list_daily_paperwork_status_v2(date '2026-08-27', 'A')
  ),
  0,
  'a caller without an authenticated identity receives no Daily Paperwork catalog'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '71000000-0000-4000-8000-000000000002',
  true
);
select set_config(
  'request.jwt.claims',
  '{"app_metadata":{"auth_version":1}}',
  true
);

select is(
  (
    select count(*)::integer
    from api.list_daily_paperwork_status_v2(date '2026-08-27', 'B')
  ),
  0,
  'an active officer cannot read the administrator Daily Paperwork catalog'
);

select is(
  (
    select count(*)::integer
    from api.get_daily_paperwork_template_v2(
      '73000000-0000-4000-8000-000000000001',
      date '2026-08-27'
    )
  ),
  0,
  'an active officer cannot read a private Daily Paperwork definition'
);

select set_config(
  'request.jwt.claim.sub',
  '71000000-0000-4000-8000-000000000001',
  true
);
select set_config(
  'request.jwt.claims',
  '{"app_metadata":{"auth_version":2}}',
  true
);

select is(
  (
    select count(*)::integer
    from api.list_daily_paperwork_status_v2(date '2026-08-27', 'A')
  ),
  0,
  'a stale administrator JWT cannot read the Daily Paperwork catalog'
);

select is(
  (
    select count(*)::integer
    from api.get_daily_paperwork_template_v2(
      '73000000-0000-4000-8000-000000000001',
      date '2026-08-27'
    )
  ),
  0,
  'a stale administrator JWT cannot read a private Daily Paperwork definition'
);

select set_config(
  'request.jwt.claims',
  '{"app_metadata":{"auth_version":1}}',
  true
);

select is(
  (
    select count(*)::integer
    from api.list_daily_paperwork_status_v2(date '2026-08-27', 'A')
  ),
  6,
  'an active administrator receives the complete six-form Daily Paperwork catalog'
);

select is(
  (
    select count(*)::integer
    from api.list_daily_paperwork_status_v2(date '2026-08-27', 'A')
    where configured
  ),
  1,
  'the catalog advertises only the one privately approved fictional template as configured'
);

select is(
  (
    select count(*)::integer
    from api.get_daily_paperwork_template_v2(
      '73000000-0000-4000-8000-000000000001',
      date '2026-08-27'
    )
  ),
  1,
  'an active same-facility administrator can read the approved private template'
);

reset role;

select throws_ok(
  $$
    update app_private.form_templates
    set title = 'Changed fictional title'
    where id = '73000000-0000-4000-8000-000000000001'
  $$,
  'Rows in app_private.form_templates are append-only',
  'an approved template version cannot be rewritten'
);

select throws_ok(
  $$
    insert into app_private.form_templates (
      facility_id, template_code, title, version, source_authority,
      source_revision, source_sha256, rights_status, print_orientation,
      capabilities, structure, field_schema, active_from, approved_at,
      approved_by_account_id
    )
    select
      facility.id, 'uniform_inspection', 'Fictional duplicate capability', 1,
      'Fictional Records Owner', 'FICTIONAL-TRAINING-V1', repeat('d', 64),
      'approved_internal_use', 'landscape', array['screen', 'screen']::text[],
      '{"schema_version":1}'::jsonb,
      '{"schema_version":1,"fields":[{"key":"supervisor_note","label":"Fictional supervisor note","type":"text","required":false,"max_length":200}],"tables":[]}'::jsonb,
      date '2026-01-01',
      timestamptz '2026-01-01T00:00:00Z',
      '71000000-0000-4000-8000-000000000001'
    from app_private.facilities as facility
  $$,
  'new row for relation "form_templates" violates check constraint "form_templates_capabilities_check"',
  'duplicate output capability claims are rejected'
);

select throws_ok(
  $$
    insert into app_private.form_templates (
      facility_id, template_code, title, version, source_authority,
      source_revision, source_sha256, rights_status, print_orientation,
      capabilities, structure, field_schema, active_from
    )
    select
      facility.id, 'uniform_inspection', 'Fictional unapproved template', 2,
      'Fictional Records Owner', 'FICTIONAL-TRAINING-V2', repeat('e', 64),
      'approved_internal_use', 'landscape', array['screen']::text[],
      '{"schema_version":1}'::jsonb,
      '{"schema_version":1,"fields":[{"key":"supervisor_note","label":"Fictional supervisor note","type":"text","required":false,"max_length":200}],"tables":[]}'::jsonb,
      date '2026-01-01'
    from app_private.facilities as facility
  $$,
  'new row for relation "form_templates" violates check constraint "form_templates_approval_check"',
  'an approved template requires bounded approval metadata'
);

insert into app_private.paperwork_records (
  id,
  facility_id,
  kind,
  work_date,
  shift_code,
  created_by_account_id
)
select
  fixture.id,
  facility.id,
  fixture.kind,
  fixture.work_date,
  fixture.shift_code,
  '71000000-0000-4000-8000-000000000001'
from app_private.facilities as facility
cross join (
  values
    (
      '74000000-0000-4000-8000-000000000001'::uuid,
      'assignment_roster'::text,
      date '2026-08-27',
      'A'::text
    ),
    (
      '74000000-0000-4000-8000-000000000002'::uuid,
      'uniform_inspection'::text,
      date '2026-08-27',
      'A'::text
    ),
    (
      '74000000-0000-4000-8000-000000000003'::uuid,
      'count_sheet'::text,
      date '2026-08-28',
      'A'::text
    )
) as fixture(id, kind, work_date, shift_code);

select throws_ok(
  $$
    insert into app_private.paperwork_revisions (
      paperwork_record_id, revision_number, editor_account_id, reason,
      structure, payload, validation, provenance
    ) values (
      '74000000-0000-4000-8000-000000000001', 1,
      '71000000-0000-4000-8000-000000000001',
      'Fictional missing-template test',
      '{"schema_version":1,"fictional_training_definition":true}'::jsonb,
      '{}'::jsonb, '{}'::jsonb, '{}'::jsonb
    )
  $$,
  '22023',
  'Daily Paperwork revisions require an approved template version',
  'a Daily Paperwork revision cannot omit its approved template version'
);

select throws_ok(
  $$
    insert into app_private.paperwork_revisions (
      paperwork_record_id, revision_number, editor_account_id, reason,
      structure, payload, validation, provenance, form_template_id
    ) values (
      '74000000-0000-4000-8000-000000000002', 1,
      '71000000-0000-4000-8000-000000000001',
      'Fictional mismatched-template test',
      '{"schema_version":1,"fictional_training_definition":true}'::jsonb,
      '{}'::jsonb, '{}'::jsonb, '{}'::jsonb,
      '73000000-0000-4000-8000-000000000001'
    )
  $$,
  '22023',
  'Daily Paperwork template does not match the record or revision',
  'a template cannot be attached to a different Daily Paperwork kind'
);

select lives_ok(
  $$
    insert into app_private.paperwork_revisions (
      paperwork_record_id, revision_number, editor_account_id, reason,
      structure, payload, validation, provenance, form_template_id
    ) values (
      '74000000-0000-4000-8000-000000000001', 1,
      '71000000-0000-4000-8000-000000000001',
      'Fictional approved-template test',
      '{"schema_version":1,"fictional_training_definition":true}'::jsonb,
      '{"schema_version":1,"fields":{"supervisor_note":"Fictional training entry"},"tables":{}}'::jsonb,
      app_private.calculate_daily_paperwork_validation(
        '{"schema_version":1,"fields":[{"key":"supervisor_note","label":"Fictional supervisor note","type":"text","required":false,"max_length":200}],"tables":[]}'::jsonb,
        '{"schema_version":1,"fields":{"supervisor_note":"Fictional training entry"},"tables":{}}'::jsonb
      ),
      '{}'::jsonb,
      '73000000-0000-4000-8000-000000000001'
    )
  $$,
  'a Daily Paperwork revision can bind to its exact approved template version'
);

select is(
  (
    select revision.form_template_id
    from app_private.paperwork_records as record
    join app_private.paperwork_revisions as revision
      on revision.paperwork_record_id = record.id
      and revision.revision_number = record.current_revision_number
    where record.id = '74000000-0000-4000-8000-000000000001'
  ),
  '73000000-0000-4000-8000-000000000001'::uuid,
  'the current Daily Paperwork head retains its exact immutable template reference'
);

select lives_ok(
  $$
    insert into app_private.paperwork_revisions (
      paperwork_record_id, revision_number, editor_account_id, reason,
      structure, payload, validation, provenance
    ) values (
      '74000000-0000-4000-8000-000000000003', 1,
      '71000000-0000-4000-8000-000000000001',
      'Fictional Count Sheet compatibility test',
      app_private.approved_count_sheet_structure(),
      app_private.blank_approved_count_sheet_payload(),
      app_private.calculate_count_sheet_validation(
        app_private.approved_count_sheet_structure(),
        app_private.blank_approved_count_sheet_payload()
      ),
      '{}'::jsonb
    )
  $$,
  'existing Count Sheet revisions remain valid without a Daily Paperwork template'
);

select throws_ok(
  $$
    insert into app_private.paperwork_revisions (
      paperwork_record_id, revision_number, editor_account_id, reason,
      structure, payload, validation, provenance, form_template_id
    ) values (
      '74000000-0000-4000-8000-000000000003', 2,
      '71000000-0000-4000-8000-000000000001',
      'Fictional invalid Count Sheet template test',
      app_private.approved_count_sheet_structure(),
      app_private.blank_approved_count_sheet_payload(),
      app_private.calculate_count_sheet_validation(
        app_private.approved_count_sheet_structure(),
        app_private.blank_approved_count_sheet_payload()
      ),
      '{}'::jsonb,
      '73000000-0000-4000-8000-000000000001'
    )
  $$,
  '22023',
  'Count Sheet revisions cannot use a Daily Paperwork template',
  'a Count Sheet revision cannot be rebound to a Daily Paperwork template'
);

insert into app_private.form_templates (
  id,
  facility_id,
  template_code,
  title,
  version,
  source_authority,
  source_revision,
  source_sha256,
  rights_status,
  print_orientation,
  capabilities,
  structure,
  field_schema,
  active_from
)
select
  '73000000-0000-4000-8000-000000000002',
  facility.id,
  'assignment_roster',
  'Fictional Retired Assignment Roster',
  2,
  'Fictional Records Owner',
  'FICTIONAL-TRAINING-RETIRED-V2',
  repeat('f', 64),
  'retired',
  'landscape',
  array['screen', 'print']::text[],
  '{"schema_version":1,"fictional_retirement_marker":true}'::jsonb,
  '{"schema_version":1,"fields":[{"key":"retired_note","label":"Fictional retired note","type":"text","required":false,"max_length":200}],"tables":[]}'::jsonb,
  date '2027-01-01'
from app_private.facilities as facility;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '71000000-0000-4000-8000-000000000001',
  true
);
select set_config(
  'request.jwt.claims',
  '{"app_metadata":{"auth_version":1}}',
  true
);

select is(
  (
    select count(*)::integer
    from api.list_daily_paperwork_status_v2(date '2027-01-01', 'A')
    where configured
  ),
  0,
  'a retirement marker suppresses every earlier approved template version'
);

select is(
  (
    select count(*)::integer
    from api.get_daily_paperwork_template_v2(
      '73000000-0000-4000-8000-000000000001',
      date '2027-01-01'
    )
  ),
  0,
  'a retired template lineage cannot be reopened through an older template ID'
);

reset role;

insert into app_private.paperwork_records (
  id,
  facility_id,
  kind,
  work_date,
  shift_code,
  created_by_account_id
)
select
  '74000000-0000-4000-8000-000000000004',
  facility.id,
  'assignment_roster',
  date '2027-01-01',
  'A',
  '71000000-0000-4000-8000-000000000001'
from app_private.facilities as facility;

select throws_ok(
  $$
    insert into app_private.paperwork_revisions (
      paperwork_record_id, revision_number, editor_account_id, reason,
      structure, payload, validation, provenance, form_template_id
    ) values (
      '74000000-0000-4000-8000-000000000004', 1,
      '71000000-0000-4000-8000-000000000001',
      'Fictional retired-template test',
      '{"schema_version":1,"fictional_training_definition":true}'::jsonb,
      '{}'::jsonb, '{}'::jsonb, '{}'::jsonb,
      '73000000-0000-4000-8000-000000000001'
    )
  $$,
  '22023',
  'Daily Paperwork template does not match the record or revision',
  'new revisions cannot keep using an older version after retirement'
);

select * from finish();
rollback;
