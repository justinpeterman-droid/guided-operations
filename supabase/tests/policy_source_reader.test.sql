begin;

select plan(12);

select has_function(
  'api',
  'get_policy_source_reader',
  array['uuid'],
  'the exact policy-source reader authorization function exists'
);

select ok(
  has_function_privilege(
    'authenticated',
    'api.get_policy_source_reader(uuid)',
    'execute'
  )
  and not has_function_privilege(
    'anon',
    'api.get_policy_source_reader(uuid)',
    'execute'
  )
  and not has_function_privilege(
    'service_role',
    'api.get_policy_source_reader(uuid)',
    'execute'
  ),
  'only authenticated sessions can request policy-source reader metadata'
);

insert into auth.users (id, email) values
  (
    '64000000-0000-4000-8000-000000000011',
    'fictional-reader-one@invalid.example'
  ),
  (
    '64000000-0000-4000-8000-000000000012',
    'fictional-reader-two@invalid.example'
  );

insert into app_private.staff_members (
  id, facility_id, employee_lookup_hash, employee_number_hint,
  display_name, status
) select
    '64000000-0000-4000-8000-000000000021',
    facility.id,
    repeat('6', 64),
    'FICT-61',
    'Fictional Reader One',
    'active'
from app_private.facilities as facility
limit 1;

insert into app_private.staff_members (
  id, facility_id, employee_lookup_hash, employee_number_hint,
  display_name, status
) select
    '64000000-0000-4000-8000-000000000022',
    facility.id,
    repeat('7', 64),
    'FICT-62',
    'Fictional Reader Two',
    'active'
from app_private.facilities as facility
limit 1;

insert into app_private.user_accounts (
  auth_user_id, staff_member_id, sign_in_alias, role, status,
  must_change_passcode, auth_version
) values
  (
    '64000000-0000-4000-8000-000000000011',
    '64000000-0000-4000-8000-000000000021',
    'fictional-reader-one@accounts.invalid',
    'officer',
    'active',
    false,
    4
  ),
  (
    '64000000-0000-4000-8000-000000000012',
    '64000000-0000-4000-8000-000000000022',
    'fictional-reader-two@accounts.invalid',
    'officer',
    'disabled',
    false,
    2
  );

insert into app_private.policy_documents (
  id, facility_id, stable_key, title, classification, status
) select
  '64000000-0000-4000-8000-000000000031',
  facility.id,
  'fictional_reader_policy',
  'Fictional Reader Qualification Policy',
  'restricted',
  'approved'
from app_private.facilities as facility
limit 1;

insert into app_private.policy_document_versions (
  id, document_id, version_label, source_sha256, storage_bucket,
  storage_path, media_type, page_count, effective_on, approved_at,
  source_filename, byte_size, rights_status, rights_evidence_ref,
  rights_reviewed_by, rights_reviewed_at, rights_review_due_at,
  allowed_processing_regions, external_ai_allowed, lifecycle_status,
  is_current
) values (
  '64000000-0000-4000-8000-000000000041',
  '64000000-0000-4000-8000-000000000031',
  'fictional-v1',
  repeat('8', 64),
  'policy-sources',
  '64000000-0000-4000-8000-000000000031/' || repeat('8', 64) || '.pdf',
  'application/pdf',
  3,
  '2026-01-01',
  statement_timestamp(),
  'fictional-reader-policy.pdf',
  4096,
  'approved_full_reader',
  'FICTIONAL-READER-RIGHTS-001',
  '64000000-0000-4000-8000-000000000021',
  statement_timestamp(),
  statement_timestamp() + interval '1 year',
  array['us-east-1'],
  false,
  'active',
  true
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{}', true);

select is(
  (
    select count(*)::integer
    from api.get_policy_source_reader(
      '64000000-0000-4000-8000-000000000041'
    )
  ),
  0,
  'a missing session subject cannot obtain policy-source metadata'
);

select set_config(
  'request.jwt.claim.sub',
  '64000000-0000-4000-8000-000000000011',
  true
);

select is(
  (
    select count(*)::integer
    from api.get_policy_source_reader(
      '64000000-0000-4000-8000-000000000041'
    )
  ),
  0,
  'a session without an auth-version claim is denied'
);

select set_config(
  'request.jwt.claims',
  '{"app_metadata":{"auth_version":4}}',
  true
);

select is(
  (
    select stable_key
    from api.get_policy_source_reader(
      '64000000-0000-4000-8000-000000000041'
    )
  ),
  'fictional_reader_policy',
  'an active same-facility session receives the exact full-reader source'
);

select is(
  (
    select storage_path
    from api.get_policy_source_reader(
      '64000000-0000-4000-8000-000000000041'
    )
  ),
  '64000000-0000-4000-8000-000000000031/' || repeat('8', 64) || '.pdf',
  'the reader returns only the content-addressed private object path'
);

select set_config(
  'request.jwt.claim.sub',
  '64000000-0000-4000-8000-000000000012',
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
    from api.get_policy_source_reader(
      '64000000-0000-4000-8000-000000000041'
    )
  ),
  0,
  'an inactive account cannot obtain the source descriptor'
);

reset role;
update app_private.policy_document_versions
set rights_status = 'approved_internal_search'
where id = '64000000-0000-4000-8000-000000000041';
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '64000000-0000-4000-8000-000000000011',
  true
);
select set_config(
  'request.jwt.claims',
  '{"app_metadata":{"auth_version":4}}',
  true
);

select is(
  (
    select count(*)::integer
    from api.get_policy_source_reader(
      '64000000-0000-4000-8000-000000000041'
    )
  ),
  0,
  'internal-search rights cannot be upgraded into full-reader rights'
);

reset role;
update app_private.policy_document_versions
set rights_status = 'approved_full_reader',
    rights_reviewed_at = statement_timestamp() - interval '2 years',
    rights_review_due_at = statement_timestamp() - interval '1 year'
where id = '64000000-0000-4000-8000-000000000041';
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '64000000-0000-4000-8000-000000000011',
  true
);
select set_config(
  'request.jwt.claims',
  '{"app_metadata":{"auth_version":4}}',
  true
);

select is(
  (
    select count(*)::integer
    from api.get_policy_source_reader(
      '64000000-0000-4000-8000-000000000041'
    )
  ),
  0,
  'an expired rights review denies the full reader'
);

reset role;
update app_private.policy_document_versions
set rights_reviewed_at = statement_timestamp(),
    rights_review_due_at = statement_timestamp() + interval '1 year',
    lifecycle_status = 'quarantined',
    is_current = false
where id = '64000000-0000-4000-8000-000000000041';
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '64000000-0000-4000-8000-000000000011',
  true
);
select set_config(
  'request.jwt.claims',
  '{"app_metadata":{"auth_version":4}}',
  true
);

select is(
  (
    select count(*)::integer
    from api.get_policy_source_reader(
      '64000000-0000-4000-8000-000000000041'
    )
  ),
  0,
  'a quarantined source is never reader-eligible'
);

reset role;
update app_private.policy_document_versions
set lifecycle_status = 'superseded',
    is_current = false
where id = '64000000-0000-4000-8000-000000000041';
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '64000000-0000-4000-8000-000000000011',
  true
);
select set_config(
  'request.jwt.claims',
  '{"app_metadata":{"auth_version":4}}',
  true
);

select is(
  (
    select lifecycle_status
    from api.get_policy_source_reader(
      '64000000-0000-4000-8000-000000000041'
    )
  ),
  'superseded',
  'a retained rights-approved superseded version remains available for old citations'
);

reset role;
update app_private.user_accounts
set auth_version = 5
where auth_user_id = '64000000-0000-4000-8000-000000000011';
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '64000000-0000-4000-8000-000000000011',
  true
);
select set_config(
  'request.jwt.claims',
  '{"app_metadata":{"auth_version":4}}',
  true
);

select is(
  (
    select count(*)::integer
    from api.get_policy_source_reader(
      '64000000-0000-4000-8000-000000000041'
    )
  ),
  0,
  'a revoked stale auth version loses reader access immediately'
);

select * from finish();
rollback;
