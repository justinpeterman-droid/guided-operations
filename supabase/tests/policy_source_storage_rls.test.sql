begin;

select plan(8);

select has_function(
  'api',
  'policy_source_object_is_readable',
  array['text'],
  'the session-bound policy-source Storage predicate exists'
);

select ok(
  has_function_privilege(
    'authenticated',
    'api.policy_source_object_is_readable(text)',
    'execute'
  )
  and not has_function_privilege(
    'anon',
    'api.policy_source_object_is_readable(text)',
    'execute'
  )
  and not has_function_privilege(
    'service_role',
    'api.policy_source_object_is_readable(text)',
    'execute'
  ),
  'only authenticated sessions can evaluate the exact-object predicate'
);

select is(
  (
    select count(*)::integer
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'policy_sources_authenticated_read'
      and cmd = 'SELECT'
  ),
  1,
  'private policy-source reads have one explicit authenticated RLS policy'
);

insert into auth.users (id, email) values (
  '65000000-0000-4000-8000-000000000011',
  'fictional-storage-reader@invalid.example'
);

insert into app_private.staff_members (
  id, facility_id, employee_lookup_hash, employee_number_hint,
  display_name, status
) select
  '65000000-0000-4000-8000-000000000021',
  facility.id,
  repeat('9', 64),
  'FICT-65',
  'Fictional Storage Reader',
  'active'
from app_private.facilities as facility
limit 1;

insert into app_private.user_accounts (
  auth_user_id, staff_member_id, sign_in_alias, role, status,
  must_change_passcode, auth_version
) values (
  '65000000-0000-4000-8000-000000000011',
  '65000000-0000-4000-8000-000000000021',
  'fictional-storage-reader@accounts.invalid',
  'officer',
  'active',
  false,
  6
);

insert into app_private.policy_documents (
  id, facility_id, stable_key, title, classification, status
) select
  '65000000-0000-4000-8000-000000000031',
  facility.id,
  'fictional_storage_policy',
  'Fictional Storage Qualification Policy',
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
  '65000000-0000-4000-8000-000000000041',
  '65000000-0000-4000-8000-000000000031',
  'fictional-v1',
  repeat('a', 64),
  'policy-sources',
  '65000000-0000-4000-8000-000000000031/' || repeat('a', 64) || '.pdf',
  'application/pdf',
  2,
  '2026-01-01',
  statement_timestamp(),
  'fictional-storage-policy.pdf',
  4096,
  'approved_full_reader',
  'FICTIONAL-STORAGE-RIGHTS-001',
  '65000000-0000-4000-8000-000000000021',
  statement_timestamp(),
  statement_timestamp() + interval '1 year',
  array['us-east-1'],
  false,
  'active',
  true
);

insert into storage.objects (bucket_id, name, metadata)
values (
  'policy-sources',
  '65000000-0000-4000-8000-000000000031/' || repeat('a', 64) || '.pdf',
  '{}'::jsonb
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{}', true);

select is(
  (select count(*)::integer from storage.objects
   where bucket_id = 'policy-sources'),
  0,
  'a missing session cannot read a private policy object'
);

select set_config(
  'request.jwt.claim.sub',
  '65000000-0000-4000-8000-000000000011',
  true
);
select set_config(
  'request.jwt.claims',
  '{"app_metadata":{"auth_version":6}}',
  true
);

select is(
  (select count(*)::integer from storage.objects
   where bucket_id = 'policy-sources'),
  1,
  'a current active same-facility session can read its approved object'
);

reset role;
update app_private.policy_document_versions
set rights_status = 'approved_internal_search'
where id = '65000000-0000-4000-8000-000000000041';
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '65000000-0000-4000-8000-000000000011',
  true
);
select set_config(
  'request.jwt.claims',
  '{"app_metadata":{"auth_version":6}}',
  true
);

select is(
  (select count(*)::integer from storage.objects
   where bucket_id = 'policy-sources'),
  0,
  'internal-search rights cannot read full policy-source bytes through Storage'
);

reset role;
update app_private.policy_document_versions
set rights_status = 'approved_full_reader',
    lifecycle_status = 'superseded',
    is_current = false
where id = '65000000-0000-4000-8000-000000000041';
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '65000000-0000-4000-8000-000000000011',
  true
);
select set_config(
  'request.jwt.claims',
  '{"app_metadata":{"auth_version":6}}',
  true
);

select is(
  (select count(*)::integer from storage.objects
   where bucket_id = 'policy-sources'),
  1,
  'an approved retained superseded object remains readable for old citations'
);

reset role;
update app_private.user_accounts
set auth_version = 7
where auth_user_id = '65000000-0000-4000-8000-000000000011';
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '65000000-0000-4000-8000-000000000011',
  true
);
select set_config(
  'request.jwt.claims',
  '{"app_metadata":{"auth_version":6}}',
  true
);

select is(
  (select count(*)::integer from storage.objects
   where bucket_id = 'policy-sources'),
  0,
  'a stale revoked auth version loses direct Storage read access'
);

select * from finish();
rollback;
