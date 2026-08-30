begin;

select plan(39);

select has_function(
  'app_private',
  'valid_daily_paperwork_field_schema',
  array['jsonb'],
  'the private Daily Paperwork schema validator exists'
);

select ok(
  has_function_privilege(
    'authenticated',
    'api.get_daily_paperwork_v2(text,date,text)',
    'execute'
  )
  and not has_function_privilege(
    'anon',
    'api.get_daily_paperwork_v2(text,date,text)',
    'execute'
  ),
  'only authenticated callers can invoke the protected Daily Paperwork reader'
);

select ok(
  has_function_privilege(
    'authenticated',
    'api.save_daily_paperwork_v2(text,date,text,integer,jsonb,text,text,text)',
    'execute'
  )
  and not has_function_privilege(
    'anon',
    'api.save_daily_paperwork_v2(text,date,text,integer,jsonb,text,text,text)',
    'execute'
  ),
  'only authenticated callers can invoke the protected Daily Paperwork writer'
);

select ok(
  app_private.valid_daily_paperwork_field_schema(
    '{
      "schema_version": 1,
      "fields": [
        {"key":"supervisor","label":"Fictional supervisor","type":"text","required":true,"max_length":100},
        {"key":"completed","label":"Completed","type":"boolean","required":false}
      ],
      "tables": [
        {
          "key":"entries","label":"Fictional entries","min_rows":0,"max_rows":2,
          "columns":[
            {"key":"post","label":"Fictional post","type":"text","required":true,"max_length":80},
            {"key":"status","label":"Status","type":"select","required":true,"options":["Ready","Needs review"]}
          ]
        }
      ]
    }'::jsonb
  ),
  'a bounded fictional flat-field and repeating-table schema is accepted'
);

select ok(
  not app_private.valid_daily_paperwork_field_schema(
    '{
      "schema_version":1,
      "fields":[
        {"key":"duplicate","label":"One","type":"boolean","required":false},
        {"key":"duplicate","label":"Two","type":"boolean","required":false}
      ],
      "tables":[]
    }'::jsonb
  ),
  'duplicate field keys are rejected'
);

select is(
  app_private.blank_daily_paperwork_payload(
    '{
      "schema_version":1,
      "fields":[{"key":"note","label":"Fictional note","type":"text","required":false,"max_length":100}],
      "tables":[{"key":"entries","label":"Fictional entries","min_rows":0,"max_rows":2,"columns":[{"key":"done","label":"Done","type":"boolean","required":false}]}]
    }'::jsonb
  ),
  '{"schema_version":1,"fields":{"note":null},"tables":{"entries":[]}}'::jsonb,
  'a closed blank value payload is derived from the private schema'
);

select is(
  app_private.calculate_daily_paperwork_validation(
    '{
      "schema_version":1,
      "fields":[{"key":"note","label":"Fictional note","type":"text","required":true,"max_length":100}],
      "tables":[{"key":"entries","label":"Fictional entries","min_rows":0,"max_rows":2,"columns":[{"key":"done","label":"Done","type":"boolean","required":false}]}]
    }'::jsonb,
    '{"schema_version":1,"fields":{"note":"Training only"},"tables":{"entries":[{"done":true}]}}'::jsonb
  ),
  '{"schema_version":1,"valid":true,"field_count":1,"table_count":1,"row_count":1}'::jsonb,
  'valid values produce content-free validation metadata'
);

select throws_ok(
  $$
    select app_private.calculate_daily_paperwork_validation(
      '{"schema_version":1,"fields":[{"key":"note","label":"Fictional note","type":"text","required":false,"max_length":100}],"tables":[]}'::jsonb,
      '{"schema_version":1,"fields":{"note":null,"extra":"not allowed"},"tables":{}}'::jsonb
    )
  $$,
  '22023',
  'Invalid Daily Paperwork values',
  'undeclared payload keys are rejected'
);

select throws_ok(
  $$
    select app_private.calculate_daily_paperwork_validation(
      '{"schema_version":1,"fields":[{"key":"note","label":"Fictional note","type":"text","required":true,"max_length":100}],"tables":[]}'::jsonb,
      '{"schema_version":1,"fields":{"note":null},"tables":{}}'::jsonb
    )
  $$,
  '22023',
  'Invalid Daily Paperwork values',
  'missing required Daily Paperwork values are rejected'
);

insert into auth.users (id, email)
values
  ('81000000-0000-4000-8000-000000000001', 'fictional-workflow-admin@example.invalid'),
  ('81000000-0000-4000-8000-000000000002', 'fictional-workflow-officer@example.invalid');

insert into app_private.staff_members (
  id, facility_id, employee_lookup_hash, employee_number_hint,
  display_name, status, shift_code
)
select fixture.id, facility.id, fixture.lookup_hash, fixture.hint,
  fixture.display_name, 'active', fixture.shift_code
from app_private.facilities as facility
cross join (
  values
    ('82000000-0000-4000-8000-000000000001'::uuid, repeat('1', 64), 'WA1', 'Fictional Workflow Administrator', 'A'),
    ('82000000-0000-4000-8000-000000000002'::uuid, repeat('2', 64), 'WO2', 'Fictional Workflow Officer', 'B')
) as fixture(id, lookup_hash, hint, display_name, shift_code);

insert into app_private.user_accounts (
  auth_user_id, staff_member_id, sign_in_alias, role, status,
  must_change_passcode
)
values
  ('81000000-0000-4000-8000-000000000001', '82000000-0000-4000-8000-000000000001', 'fictional-workflow-admin-auth@example.invalid', 'administrator', 'active', false),
  ('81000000-0000-4000-8000-000000000002', '82000000-0000-4000-8000-000000000002', 'fictional-workflow-officer-auth@example.invalid', 'officer', 'active', false);

select throws_ok(
  $$
    insert into app_private.form_templates (
      facility_id, template_code, title, version, source_authority,
      source_revision, source_sha256, rights_status, print_orientation,
      capabilities, structure, field_schema, active_from, approved_at,
      approved_by_account_id
    )
    select facility.id, 'uniform_inspection', 'Invalid fictional form', 1,
      'Fictional Records Owner', 'INVALID-FICTIONAL-V1', repeat('3', 64),
      'approved_internal_use', 'portrait', array['screen']::text[],
      '{"schema_version":1}'::jsonb, '{}'::jsonb, date '2026-01-01',
      timestamptz '2026-01-01T00:00:00Z',
      '81000000-0000-4000-8000-000000000001'
    from app_private.facilities as facility
  $$,
  '22023',
  'Invalid Daily Paperwork template definition',
  'an unrenderable private template cannot be registered'
);

insert into app_private.form_templates (
  id, facility_id, template_code, title, version, source_authority,
  source_revision, source_sha256, rights_status, print_orientation,
  capabilities, structure, field_schema, active_from, approved_at,
  approved_by_account_id
)
select '83000000-0000-4000-8000-000000000001', facility.id,
  'assignment_roster', 'Fictional Training Assignment Roster', 1,
  'Fictional Records Owner', 'FICTIONAL-WORKFLOW-V1', repeat('4', 64),
  'approved_internal_use', 'landscape', array['screen', 'print']::text[],
  '{"schema_version":1,"layout":"fictional-training-only"}'::jsonb,
  '{
    "schema_version": 1,
    "fields": [
      {"key":"supervisor","label":"Fictional supervisor","type":"text","required":true,"max_length":100},
      {"key":"completed","label":"Completed","type":"boolean","required":false}
    ],
    "tables": [
      {
        "key":"entries","label":"Fictional entries","min_rows":0,"max_rows":2,
        "columns":[
          {"key":"post","label":"Fictional post","type":"text","required":true,"max_length":80},
          {"key":"status","label":"Status","type":"select","required":true,"options":["Ready","Needs review"]}
        ]
      }
    ]
  }'::jsonb,
  date '2026-01-01', timestamptz '2026-01-01T00:00:00Z',
  '81000000-0000-4000-8000-000000000001'
from app_private.facilities as facility;

select is(
  (select count(*)::integer from api.get_daily_paperwork_v2('assignment_roster', date '2026-08-27', 'A')),
  0,
  'an unauthenticated caller cannot read a Daily Paperwork definition'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claims', '{"app_metadata":{"auth_version":1}}', true);

select is(
  (select count(*)::integer from api.get_daily_paperwork_v2('assignment_roster', date '2026-08-27', 'B')),
  0,
  'an officer cannot read Daily Paperwork'
);

select throws_ok(
  $$
    select * from api.save_daily_paperwork_v2(
      'assignment_roster', date '2026-08-27', 'B', 0,
      '{"schema_version":1,"fields":{"supervisor":"Fictional","completed":null},"tables":{"entries":[]}}'::jsonb,
      'Fictional officer denial', repeat('5', 64), repeat('6', 64)
    )
  $$,
  '42501',
  'Not authorized to save Daily Paperwork',
  'an officer cannot save Daily Paperwork'
);

select is(
  (select count(*)::integer from api.list_daily_paperwork_revisions_v2('84000000-0000-4000-8000-000000000001')),
  0,
  'an officer cannot list Daily Paperwork revision history'
);

select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"app_metadata":{"auth_version":2}}', true);

select is(
  (select count(*)::integer from api.get_daily_paperwork_v2('assignment_roster', date '2026-08-27', 'A')),
  0,
  'a stale administrator session cannot read Daily Paperwork'
);

select set_config('request.jwt.claims', '{"app_metadata":{"auth_version":1}}', true);

select is(
  (select count(*)::integer from api.get_daily_paperwork_v2('assignment_roster', date '2026-08-27', 'A')),
  1,
  'a current administrator can open the approved private form'
);

select ok(
  (select editable from api.get_daily_paperwork_v2('assignment_roster', date '2026-08-27', 'A')),
  'the controlling template is editable before a later version exists'
);

select is(
  (select record_id from api.get_daily_paperwork_v2('assignment_roster', date '2026-08-27', 'A')),
  null::uuid,
  'a never-saved form opens as a blank template without inventing a record'
);

select is(
  (
    select revision_number
    from api.save_daily_paperwork_v2(
      'assignment_roster', date '2026-08-27', 'A', 0,
      '{"schema_version":1,"fields":{"supervisor":"Fictional Supervisor","completed":false},"tables":{"entries":[{"post":"Training Post 1","status":"Ready"}]}}'::jsonb,
      'Fictional initial save', repeat('7', 64), repeat('8', 64)
    )
  ),
  1,
  'the first administrator save creates revision one'
);

select is(
  (
    select revision_number
    from api.save_daily_paperwork_v2(
      'assignment_roster', date '2026-08-27', 'A', 0,
      '{"schema_version":1,"fields":{"supervisor":"Fictional Supervisor","completed":false},"tables":{"entries":[{"post":"Training Post 1","status":"Ready"}]}}'::jsonb,
      'Fictional initial save', repeat('7', 64), repeat('8', 64)
    )
  ),
  1,
  'an exact retry returns the original save result'
);

select is(
  (
    select current_revision_number
    from api.get_daily_paperwork_v2(
      'assignment_roster', date '2026-08-27', 'A'
    )
  ),
  1,
  'an idempotent retry does not append another revision'
);

select is(
  (select payload->'fields'->>'supervisor' from api.get_daily_paperwork_v2('assignment_roster', date '2026-08-27', 'A')),
  'Fictional Supervisor',
  'the current exact saved values can be reopened'
);

select is(
  (
    select count(*)::integer
    from api.list_daily_paperwork_revisions_v2(
      (select record_id from api.get_daily_paperwork_v2('assignment_roster', date '2026-08-27', 'A'))
    )
  ),
  1,
  'revision history lists the first immutable save'
);

select is(
  (
    select template_version
    from api.get_daily_paperwork_revision_v2(
      (select record_id from api.get_daily_paperwork_v2('assignment_roster', date '2026-08-27', 'A')),
      1
    )
  ),
  1,
  'an immutable revision keeps its exact source-template version'
);

select throws_ok(
  $$
    select * from api.save_daily_paperwork_v2(
      'assignment_roster', date '2026-08-27', 'A', 0,
      '{"schema_version":1,"fields":{"supervisor":"Stale fictional save","completed":true},"tables":{"entries":[]}}'::jsonb,
      'Fictional stale save', repeat('9', 64), repeat('a', 64)
    )
  $$,
  '40001',
  'Daily Paperwork revision conflict',
  'a stale browser save is rejected'
);

select is(
  (
    select revision_number
    from api.save_daily_paperwork_v2(
      'assignment_roster', date '2026-08-27', 'A', 1,
      '{"schema_version":1,"fields":{"supervisor":"Fictional Supervisor","completed":true},"tables":{"entries":[{"post":"Training Post 1","status":"Needs review"}]}}'::jsonb,
      'Fictional second save', repeat('b', 64), repeat('c', 64)
    )
  ),
  2,
  'a current save appends revision two'
);

reset role;

select throws_ok(
  $$
    insert into app_private.paperwork_revisions (
      paperwork_record_id, revision_number, editor_account_id, reason,
      structure, payload, validation, provenance, form_template_id
    )
    select record.id, 3, '81000000-0000-4000-8000-000000000001',
      'Fictional forged validation', template.structure,
      '{"schema_version":1,"fields":{"supervisor":"Fictional Supervisor","completed":true},"tables":{"entries":[]}}'::jsonb,
      '{}'::jsonb, '{}'::jsonb, template.id
    from app_private.paperwork_records as record
    join app_private.form_templates as template
      on template.id = '83000000-0000-4000-8000-000000000001'
    where record.kind = 'assignment_roster' and record.work_date = date '2026-08-27' and record.shift_code = 'A'
  $$,
  '22023',
  'Daily Paperwork validation was not derived from the approved template',
  'a direct insert cannot forge server-derived validation'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"app_metadata":{"auth_version":1}}', true);

select is(
  api.restore_daily_paperwork_revision_v2(
    (select record_id from api.get_daily_paperwork_v2('assignment_roster', date '2026-08-27', 'A')),
    2, 1, 'Fictional restore test', repeat('d', 64), repeat('e', 64)
  ),
  3,
  'restoring revision one appends revision three'
);

select is(
  (select payload->'fields'->>'completed' from api.get_daily_paperwork_v2('assignment_roster', date '2026-08-27', 'A')),
  'false',
  'restore copies the exact historical payload'
);

select is(
  (
    select restored_from_revision_number
    from api.get_daily_paperwork_revision_v2(
      (select record_id from api.get_daily_paperwork_v2('assignment_roster', date '2026-08-27', 'A')),
      3
    )
  ),
  1,
  'the appended restore records its historical source revision'
);

select throws_ok(
  $$
    select api.record_daily_paperwork_print_v2(
      (select record_id from api.get_daily_paperwork_v2('assignment_roster', date '2026-08-27', 'A')),
      2, repeat('f', 64), repeat('0', 64), '85000000-0000-4000-8000-000000000001'
    )
  $$,
  '40001',
  'Daily Paperwork revision conflict',
  'printing a stale saved revision is rejected'
);

create temporary table fictional_print_receipt as
select api.record_daily_paperwork_print_v2(
  (select record_id from api.get_daily_paperwork_v2('assignment_roster', date '2026-08-27', 'A')),
  3, repeat('0', 64), repeat('1', 64), '85000000-0000-4000-8000-000000000002'
) as event_id;

select ok(
  (select event_id is not null from fictional_print_receipt),
  'a current printable revision records its audit before printing'
);

select is(
  api.record_daily_paperwork_print_v2(
    (select record_id from api.get_daily_paperwork_v2('assignment_roster', date '2026-08-27', 'A')),
    3, repeat('0', 64), repeat('1', 64), '85000000-0000-4000-8000-000000000002'
  ),
  (select event_id from fictional_print_receipt),
  'an exact print retry returns the original audit receipt'
);

reset role;

select is(
  (
    select array_agg(key order by key)
    from app_private.audit_events as event,
      jsonb_object_keys(event.metadata) as key
    where event.event_id = (select event_id from fictional_print_receipt)
  ),
  array['action', 'kind', 'revision_number', 'template_version']::text[],
  'print audit metadata contains identifiers only and no form values'
);

insert into app_private.form_templates (
  id, facility_id, template_code, title, version, source_authority,
  source_revision, source_sha256, rights_status, print_orientation,
  capabilities, structure, field_schema, active_from
)
select '83000000-0000-4000-8000-000000000002', facility.id,
  'assignment_roster', 'Fictional retired marker', 2,
  'Fictional Records Owner', 'FICTIONAL-RETIRED-V2', repeat('5', 64),
  'retired', 'landscape', array['screen', 'print']::text[],
  '{"schema_version":1,"retired":true}'::jsonb,
  '{"schema_version":1,"fields":[{"key":"retired_note","label":"Fictional retired note","type":"text","required":false,"max_length":100}],"tables":[]}'::jsonb,
  date '2026-01-01'
from app_private.facilities as facility;

set local role authenticated;
select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"app_metadata":{"auth_version":1}}', true);

select is(
  (select editable from api.get_daily_paperwork_v2('assignment_roster', date '2026-08-27', 'A')),
  false,
  'a retirement marker makes the saved historical form read-only'
);

select throws_ok(
  $$
    select * from api.save_daily_paperwork_v2(
      'assignment_roster', date '2026-08-27', 'A', 3,
      '{"schema_version":1,"fields":{"supervisor":"Fictional","completed":true},"tables":{"entries":[]}}'::jsonb,
      'Fictional retired save', repeat('6', 64), repeat('7', 64)
    )
  $$,
  '22023',
  'Daily Paperwork template is unavailable',
  'new saves stop after the approved template lineage is retired'
);

select is(
  api.restore_daily_paperwork_revision_v2(
    (select record_id from api.get_daily_paperwork_v2('assignment_roster', date '2026-08-27', 'A')),
    3, 1, 'Fictional historical restore after retirement', repeat('8', 64), repeat('9', 64)
  ),
  4,
  'an exact historical revision can still be restored after template retirement'
);

select is(
  (
    select template_id
    from api.get_daily_paperwork_revision_v2(
      (select record_id from api.get_daily_paperwork_v2('assignment_roster', date '2026-08-27', 'A')),
      4
    )
  ),
  '83000000-0000-4000-8000-000000000001'::uuid,
  'a historical restore keeps the exact original template identity'
);

reset role;

select throws_ok(
  $$
    update app_private.paperwork_revisions
    set reason = 'Changed fictional reason'
    where paperwork_record_id = (
      select id from app_private.paperwork_records
      where kind = 'assignment_roster' and work_date = date '2026-08-27' and shift_code = 'A'
    ) and revision_number = 1
  $$,
  'Rows in app_private.paperwork_revisions are append-only',
  'saved Daily Paperwork revisions cannot be rewritten'
);

select * from finish();
rollback;
