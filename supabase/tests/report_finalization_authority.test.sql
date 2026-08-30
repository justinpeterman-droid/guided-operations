begin;

select plan(12);

insert into auth.users (id, email)
values
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    'fictional-finalization-admin@example.invalid'
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
    'fictional-reporting-officer@example.invalid'
  ),
  (
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc3',
    'fictional-incident-preparer@example.invalid'
  ),
  (
    '99999999-9999-4999-8999-999999999994',
    'fictional-other-reporting-officer@example.invalid'
  );

insert into app_private.staff_members (
  id,
  facility_id,
  employee_lookup_hash,
  employee_number_hint,
  display_name,
  status
)
select
  fixture.id,
  facility.id,
  fixture.employee_lookup_hash,
  fixture.employee_number_hint,
  fixture.display_name,
  'active'
from app_private.facilities as facility
cross join (
  values
    (
      'dddddddd-dddd-4ddd-8ddd-ddddddddddd1'::uuid,
      repeat('1', 64),
      'A1',
      'Fictional Administrator'
    ),
    (
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2'::uuid,
      repeat('2', 64),
      'B2',
      'Fictional Reporting Officer'
    ),
    (
      'ffffffff-ffff-4fff-8fff-fffffffffff3'::uuid,
      repeat('3', 64),
      'C3',
      'Fictional Incident Preparer'
    ),
    (
      '88888888-8888-4888-8888-888888888884'::uuid,
      repeat('4', 64),
      'D4',
      'Fictional Other Reporting Officer'
    )
) as fixture(id, employee_lookup_hash, employee_number_hint, display_name);

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
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    'dddddddd-dddd-4ddd-8ddd-ddddddddddd1',
    'fictional-finalization-admin-auth@example.invalid',
    'administrator',
    'active',
    false
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2',
    'fictional-reporting-officer-auth@example.invalid',
    'officer',
    'active',
    false
  ),
  (
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc3',
    'ffffffff-ffff-4fff-8fff-fffffffffff3',
    'fictional-incident-preparer-auth@example.invalid',
    'officer',
    'active',
    false
  ),
  (
    '99999999-9999-4999-8999-999999999994',
    '88888888-8888-4888-8888-888888888884',
    'fictional-other-reporting-officer-auth@example.invalid',
    'officer',
    'active',
    false
  );

insert into app_private.incidents (
  id,
  facility_id,
  created_by_account_id,
  incident_number,
  display_name,
  status,
  occurred_at,
  category,
  current_revision_number
)
select
  '10000000-0000-4000-8000-000000000001',
  facility.id,
  'cccccccc-cccc-4ccc-8ccc-ccccccccccc3',
  'FICTIONAL-FINALIZATION-AUTHORITY-001',
  'Fictional finalization authority scenario',
  'in_review',
  '2026-08-27T12:00:00Z'::timestamptz,
  'training',
  0
from app_private.facilities as facility;

insert into app_private.incident_revisions (
  id,
  incident_id,
  revision_number,
  editor_account_id,
  schema_version,
  field_notes,
  reviewed_facts
)
values (
  '20000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  1,
  'cccccccc-cccc-4ccc-8ccc-ccccccccccc3',
  2,
  '[]'::jsonb,
  '[{"id":"30000000-0000-4000-8000-000000000001","field":"Fictional field","state":"confirmed","value":"Fictional scoped value","sourceNoteIds":[],"reportingStaffMemberIds":["eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2"]}]'::jsonb
);

insert into app_private.incident_staff_relationships (
  incident_revision_id,
  staff_member_id,
  relationship,
  selected_by_account_id
)
values
  (
    '20000000-0000-4000-8000-000000000001',
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2',
    'reporting_officer',
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc3'
  ),
  (
    '20000000-0000-4000-8000-000000000001',
    'ffffffff-ffff-4fff-8fff-fffffffffff3',
    'preparer',
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc3'
  ),
  (
    '20000000-0000-4000-8000-000000000001',
    '88888888-8888-4888-8888-888888888884',
    'reporting_officer',
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc3'
  );

insert into app_private.report_draft_candidates (
  id,
  incident_id,
  source_incident_revision_id,
  requested_by_account_id,
  reporting_staff_member_id,
  report_type,
  source_fact_ids,
  paragraphs,
  provider_key
)
values
  (
    '40000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc3',
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2',
    'first_person',
    array['30000000-0000-4000-8000-000000000001']::uuid[],
    '[{"text":"Fictional first-person candidate.","sourceFactIds":["30000000-0000-4000-8000-000000000001"]}]'::jsonb,
    'fictional-provider-v1'
  ),
  (
    '40000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc3',
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2',
    'cover_letter',
    array['30000000-0000-4000-8000-000000000001']::uuid[],
    '[{"text":"Fictional administrator-review candidate.","sourceFactIds":["30000000-0000-4000-8000-000000000001"]}]'::jsonb,
    'fictional-provider-v1'
  ),
  (
    '40000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc3',
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2',
    'disciplinary',
    array['30000000-0000-4000-8000-000000000001']::uuid[],
    '[{"text":"Fictional other-reporter candidate.","sourceFactIds":["30000000-0000-4000-8000-000000000001"]}]'::jsonb,
    'fictional-provider-v1'
  ),
  (
    '40000000-0000-4000-8000-000000000004',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc3',
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2',
    'supervisor_summary',
    array['30000000-0000-4000-8000-000000000001']::uuid[],
    '[{"text":"Fictional candidate that becomes stale.","sourceFactIds":["30000000-0000-4000-8000-000000000001"]}]'::jsonb,
    'fictional-provider-v1'
  );

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  'cccccccc-cccc-4ccc-8ccc-ccccccccccc3',
  true
);

select throws_ok(
  $$
    select api.finalize_report_draft_candidate(
      '40000000-0000-4000-8000-000000000001',
      'Fictional narrative that the preparer must not finalize for another officer.',
      repeat('1', 64),
      repeat('2', 64)
    )
  $$,
  '42501',
  'Not authorized to finalize this report draft',
  'an ordinary incident preparer cannot finalize a report attributed to another officer'
);

reset role;

select is(
  (
    select count(*)::integer
    from app_private.reports
    where report_type = 'first_person'
  ),
  0,
  'the denied cross-officer attempt creates no report'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '99999999-9999-4999-8999-999999999994',
  true
);

select throws_ok(
  $$
    select api.finalize_report_draft_candidate(
      '40000000-0000-4000-8000-000000000003',
      'Fictional narrative that a different reporting officer must not finalize.',
      repeat('7', 64),
      repeat('8', 64)
    )
  $$,
  '42501',
  'Not authorized to finalize this report draft',
  'a different reporting officer on the incident cannot finalize another officer report'
);

reset role;

select is(
  (
    select count(*)::integer
    from app_private.reports
    where report_type = 'disciplinary'
  ),
  0,
  'the denied other-reporter attempt creates no report'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
  true
);

select lives_ok(
  $$
    select api.finalize_report_draft_candidate(
      '40000000-0000-4000-8000-000000000001',
      'Fictional narrative reviewed and finalized by its reporting officer.',
      repeat('3', 64),
      repeat('4', 64)
    )
  $$,
  'the reporting officer can finalize their own attributed report'
);

reset role;

select ok(
  exists (
    select 1
    from app_private.reports as report
    join app_private.report_revisions as revision
      on revision.report_id = report.id
      and revision.revision_number = 1
    where report.report_type = 'first_person'
      and report.reporting_account_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'
      and report.prepared_by_account_id = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc3'
      and revision.editor_account_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'
  ),
  'reporting, preparing, and final-editor attribution remain distinct'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  true
);

select lives_ok(
  $$
    select api.finalize_report_draft_candidate(
      '40000000-0000-4000-8000-000000000002',
      'Fictional narrative finalized through administrator authority.',
      repeat('5', 64),
      repeat('6', 64)
    )
  $$,
  'a same-facility administrator retains report finalization authority'
);

reset role;

select ok(
  exists (
    select 1
    from app_private.reports as report
    join app_private.report_revisions as revision
      on revision.report_id = report.id
      and revision.revision_number = 1
    where report.report_type = 'cover_letter'
      and report.reporting_account_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'
      and report.prepared_by_account_id = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc3'
      and revision.editor_account_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
  ),
  'administrator finalization preserves the original reporting and preparing officers'
);

insert into app_private.incident_revisions (
  id,
  incident_id,
  revision_number,
  editor_account_id,
  schema_version,
  field_notes,
  reviewed_facts
)
values (
  '20000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000001',
  2,
  'cccccccc-cccc-4ccc-8ccc-ccccccccccc3',
  2,
  '[]'::jsonb,
  '[{"id":"30000000-0000-4000-8000-000000000002","field":"Updated fictional field","state":"confirmed","value":"Changed fictional value","sourceNoteIds":[],"reportingStaffMemberIds":["eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2"]}]'::jsonb
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  true
);

select throws_ok(
  $$
    select api.finalize_report_draft_candidate(
      '40000000-0000-4000-8000-000000000004',
      'Fictional narrative from a candidate whose incident facts changed.',
      repeat('9', 64),
      repeat('a', 64)
    )
  $$,
  '40001',
  'Report draft is stale and must be regenerated',
  'an administrator cannot finalize a candidate after the incident revision changes'
);

reset role;

select is(
  (
    select count(*)::integer
    from app_private.reports
    where report_type = 'supervisor_summary'
  ),
  0,
  'the denied stale-candidate attempt creates no report'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  true
);

select lives_ok(
  $$
    select api.finalize_report_draft_candidate(
      '40000000-0000-4000-8000-000000000002',
      'Fictional narrative finalized through administrator authority.',
      repeat('5', 64),
      repeat('6', 64)
    )
  $$,
  'an exact successful retry remains idempotent after the incident later changes'
);

reset role;

select is(
  (
    select count(*)::integer
    from app_private.reports
    where report_type = 'cover_letter'
  ),
  1,
  'the successful retry returns the prior result without creating another report'
);

select * from finish();
rollback;
