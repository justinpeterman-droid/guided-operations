begin;

select plan(19);

insert into auth.users (id, email)
values
  ('a1000000-0000-4000-8000-000000000001', 'fictional-docx-officer@example.invalid'),
  ('a1000000-0000-4000-8000-000000000002', 'fictional-docx-admin@example.invalid'),
  ('a1000000-0000-4000-8000-000000000003', 'fictional-docx-unrelated@example.invalid');

insert into app_private.staff_members (
  id, facility_id, employee_lookup_hash, employee_number_hint, display_name, status
)
select fixture.id, facility.id, fixture.lookup_hash, fixture.hint, fixture.name, 'active'
from app_private.facilities as facility
cross join (
  values
    ('b1000000-0000-4000-8000-000000000001'::uuid, repeat('a', 64), 'X1', 'Fictional DOCX Officer'),
    ('b1000000-0000-4000-8000-000000000002'::uuid, repeat('b', 64), 'X2', 'Fictional DOCX Administrator'),
    ('b1000000-0000-4000-8000-000000000003'::uuid, repeat('c', 64), 'X3', 'Fictional Unrelated Officer')
) as fixture(id, lookup_hash, hint, name);

insert into app_private.user_accounts (
  auth_user_id, staff_member_id, sign_in_alias, role, status, must_change_passcode
)
values
  ('a1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'fictional-docx-officer-auth@example.invalid', 'officer', 'active', false),
  ('a1000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000002', 'fictional-docx-admin-auth@example.invalid', 'administrator', 'active', false),
  ('a1000000-0000-4000-8000-000000000003', 'b1000000-0000-4000-8000-000000000003', 'fictional-docx-unrelated-auth@example.invalid', 'officer', 'active', false);

insert into app_private.incidents (
  id, facility_id, created_by_account_id, incident_number, display_name,
  status, occurred_at, category, current_revision_number
)
select
  'c1000000-0000-4000-8000-000000000001', facility.id,
  'a1000000-0000-4000-8000-000000000001', 'FICTIONAL-DOCX-001',
  'Fictional DOCX qualification', 'complete', '2026-08-27T12:00:00Z',
  'training', 0
from app_private.facilities as facility;

insert into app_private.incident_revisions (
  id, incident_id, revision_number, editor_account_id, schema_version,
  field_notes, reviewed_facts
)
values (
  'd1000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001', 1,
  'a1000000-0000-4000-8000-000000000001', 2, '[]', '[]'
);

insert into app_private.reports (
  id, incident_id, report_type, reporting_account_id, prepared_by_account_id,
  status, current_revision_number
)
values
  (
    'e1000000-0000-4000-8000-000000000001',
    'c1000000-0000-4000-8000-000000000001', 'first_person',
    'a1000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000001', 'complete', 0
  );

insert into app_private.reports (
  id, incident_id, report_type, reporting_account_id, prepared_by_account_id,
  status, current_revision_number
)
values
  (
    'e1000000-0000-4000-8000-000000000002',
    'c1000000-0000-4000-8000-000000000001', 'disciplinary',
    'a1000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000001', 'complete', 0
  );

insert into app_private.report_revisions (
  id, report_id, revision_number, editor_account_id,
  source_incident_revision_id, narrative, schema_version
)
values
  (
    'f1000000-0000-4000-8000-000000000001',
    'e1000000-0000-4000-8000-000000000001', 1,
    'a1000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000001',
    'Fictional historical reviewed narrative.', 2
  );

insert into app_private.report_revisions (
  id, report_id, revision_number, editor_account_id,
  source_incident_revision_id, narrative, schema_version
)
values
  (
    'f1000000-0000-4000-8000-000000000002',
    'e1000000-0000-4000-8000-000000000001', 2,
    'a1000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000001',
    'Fictional current reviewed narrative.', 2
  );

insert into app_private.report_revisions (
  id, report_id, revision_number, editor_account_id,
  source_incident_revision_id, narrative, schema_version
)
values
  (
    'f1000000-0000-4000-8000-000000000003',
    'e1000000-0000-4000-8000-000000000002', 1,
    'a1000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000001',
    'Fictional copy-only narrative.', 2
  );

insert into app_private.report_access (
  report_id, account_id, relationship, granted_by_account_id
)
values
  (
    'e1000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000001', 'owner',
    'a1000000-0000-4000-8000-000000000001'
  ),
  (
    'e1000000-0000-4000-8000-000000000002',
    'a1000000-0000-4000-8000-000000000001', 'owner',
    'a1000000-0000-4000-8000-000000000001'
  );

select ok(
  has_function_privilege('authenticated', 'api.get_report_revision_for_export(uuid,integer)', 'execute')
  and not has_function_privilege('anon', 'api.get_report_revision_for_export(uuid,integer)', 'execute')
  and not has_function_privilege('service_role', 'api.get_report_revision_for_export(uuid,integer)', 'execute'),
  'only authenticated sessions can call the exact-revision export reader'
);

select ok(
  has_function_privilege('authenticated', 'api.record_report_docx_export(uuid,integer,text,integer,text,text,text,uuid)', 'execute')
  and not has_function_privilege('anon', 'api.record_report_docx_export(uuid,integer,text,integer,text,text,text,uuid)', 'execute')
  and not has_function_privilege('service_role', 'api.record_report_docx_export(uuid,integer,text,integer,text,text,text,uuid)', 'execute'),
  'only authenticated sessions can record a DOCX export'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000001', true);

select is(
  (select count(*)::integer from api.get_report_revision_for_export(
    'e1000000-0000-4000-8000-000000000001', 1
  )),
  1,
  'an active report owner can export an explicit historical revision'
);

select is(
  (select narrative from api.get_report_revision_for_export(
    'e1000000-0000-4000-8000-000000000001', 1
  )),
  'Fictional historical reviewed narrative.',
  'the export reader returns the exact named immutable revision'
);

select lives_ok(
  $$ select set_config(
    'app.test.export_id',
    api.record_report_docx_export(
      'e1000000-0000-4000-8000-000000000001', 1, repeat('1', 64), 4096,
      'guided-operations-reviewed-report-v1', repeat('2', 64), repeat('3', 64),
      '01000000-0000-4000-8000-000000000001'
    )::text,
    true
  ) $$,
  'the owner can record the authorized explicit-revision download'
);

reset role;

select is(
  (
    select metadata ->> 'revision_number'
    from app_private.audit_events
    where event_type = 'report.docx.exported'
      and actor_auth_user_id = 'a1000000-0000-4000-8000-000000000001'
  ),
  '1',
  'the audit records the chosen revision number'
);

select ok(
  (
    select metadata ?& array['action', 'revision_number', 'output_sha256', 'size_bytes', 'template_version']
      and not (metadata::text ilike '%narrative%')
      and not (metadata::text ilike '%Fictional historical%')
    from app_private.audit_events
    where event_type = 'report.docx.exported'
      and actor_auth_user_id = 'a1000000-0000-4000-8000-000000000001'
  ),
  'the audit contains bounded integrity metadata and no report text'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000001', true);

select is(
  api.record_report_docx_export(
    'e1000000-0000-4000-8000-000000000001', 1, repeat('1', 64), 4096,
    'guided-operations-reviewed-report-v1', repeat('2', 64), repeat('3', 64),
    '01000000-0000-4000-8000-000000000002'
  ),
  current_setting('app.test.export_id')::uuid,
  'an identical retry returns the original export audit ID'
);

select throws_ok(
  $$ select api.record_report_docx_export(
    'e1000000-0000-4000-8000-000000000001', 1, repeat('1', 64), 4096,
    'guided-operations-reviewed-report-v1', repeat('2', 64), repeat('4', 64),
    '01000000-0000-4000-8000-000000000003'
  ) $$,
  '22023', 'Retry key was reused for a different request',
  'a retry key cannot be reused for different output metadata'
);

select is(
  (select count(*)::integer from api.get_report_revision_for_export(
    'e1000000-0000-4000-8000-000000000002', 1
  )),
  0,
  'copy-only disciplinary text cannot be exported as a Word report'
);

select throws_ok(
  $$ select api.record_report_docx_export(
    'e1000000-0000-4000-8000-000000000002', 1, repeat('5', 64), 4096,
    'guided-operations-reviewed-report-v1', repeat('6', 64), repeat('7', 64),
    '01000000-0000-4000-8000-000000000004'
  ) $$,
  '42501', 'Not authorized to export this report',
  'copy-only output cannot be recorded as a DOCX export'
);

select throws_ok(
  $$ select api.record_report_print(
    'e1000000-0000-4000-8000-000000000002', 1,
    repeat('d', 64), repeat('e', 64),
    '01000000-0000-4000-8000-000000000008'
  ) $$,
  '42501', 'Not authorized to print this report',
  'copy-only output cannot be sent to browser print'
);

select throws_ok(
  $$ select api.record_report_docx_export(
    'e1000000-0000-4000-8000-000000000001', 9, repeat('8', 64), 4096,
    'guided-operations-reviewed-report-v1', repeat('9', 64), repeat('a', 64),
    '01000000-0000-4000-8000-000000000005'
  ) $$,
  '40001', 'Report revision conflict',
  'a missing revision cannot be recorded as exported'
);

reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000003', true);

select is(
  (select count(*)::integer from api.get_report_revision_for_export(
    'e1000000-0000-4000-8000-000000000001', 1
  )),
  0,
  'an unrelated officer cannot read another officer report revision'
);

select throws_ok(
  $$ select api.record_report_docx_export(
    'e1000000-0000-4000-8000-000000000001', 1, repeat('b', 64), 4096,
    'guided-operations-reviewed-report-v1', repeat('c', 64), repeat('d', 64),
    '01000000-0000-4000-8000-000000000006'
  ) $$,
  '42501', 'Not authorized to export this report',
  'an unrelated officer cannot record another officer report export'
);

reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000002', true);

select is(
  (select count(*)::integer from api.get_report_revision_for_export(
    'e1000000-0000-4000-8000-000000000001', 1
  )),
  1,
  'a same-facility administrator can read an officer historical report revision'
);

select lives_ok(
  $$ select api.record_report_docx_export(
    'e1000000-0000-4000-8000-000000000001', 1, repeat('e', 64), 4096,
    'guided-operations-reviewed-report-v1', repeat('f', 64), repeat('0', 64),
    '01000000-0000-4000-8000-000000000007'
  ) $$,
  'a same-facility administrator can record the officer report export'
);

reset role;

select is(
  (
    select count(*)::integer
    from app_private.audit_events
    where event_type = 'report.docx.exported'
  ),
  2,
  'only the authorized owner and administrator exports created audit events'
);

select is(
  (
    select count(*)::integer
    from app_private.idempotency_records
    where action = 'report.output.docx'
  ),
  2,
  'failed and conflicting export attempts leave no extra retry records'
);

select * from finish();
rollback;
