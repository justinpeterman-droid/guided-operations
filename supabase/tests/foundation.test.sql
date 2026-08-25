begin;

select plan(48);

select has_schema('api', 'locked Data API schema exists');
select has_schema('app_private', 'app_private schema exists');
select has_table('app_private', 'facilities', 'facilities table exists');
select has_table('app_private', 'staff_members', 'staff_members table exists');
select has_table('app_private', 'user_accounts', 'user_accounts table exists');
select has_table('app_private', 'policy_documents', 'policy_documents table exists');
select has_table(
  'app_private',
  'policy_document_versions',
  'policy_document_versions table exists'
);
select has_table('app_private', 'policy_chunks', 'policy_chunks table exists');
select has_table(
  'app_private',
  'embedding_profiles',
  'embedding_profiles table exists'
);
select has_table(
  'app_private',
  'policy_chunk_embeddings',
  'policy_chunk_embeddings table exists'
);
select has_table('app_private', 'audit_events', 'audit_events table exists');
select has_table('app_private', 'incidents', 'incidents table exists');
select has_table('app_private', 'incident_revisions', 'incident revisions table exists');
select has_table('app_private', 'reports', 'reports table exists');
select has_table('app_private', 'report_access', 'report access table exists');
select has_table('app_private', 'report_revisions', 'report revisions table exists');

select is(
  (
    select namespace.nspname
    from pg_extension as extension
    join pg_namespace as namespace on namespace.oid = extension.extnamespace
    where extension.extname = 'pgcrypto'
  ),
  'extensions',
  'pgcrypto is installed in the extensions schema'
);

select is(
  (
    select namespace.nspname
    from pg_extension as extension
    join pg_namespace as namespace on namespace.oid = extension.extnamespace
    where extension.extname = 'vector'
  ),
  'extensions',
  'vector is installed in the extensions schema'
);

select is(
  (
    select count(*)::integer
    from pg_class as relation
    join pg_namespace as namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'app_private'
      and relation.relkind in ('r', 'p')
      and (not relation.relrowsecurity or not relation.relforcerowsecurity)
  ),
  0,
  'every application table enables and forces row-level security'
);

select is(
  (
    select count(*)::integer
    from information_schema.table_privileges
    where table_schema = 'app_private'
      and grantee in ('PUBLIC', 'anon', 'authenticated', 'service_role')
  ),
  0,
  'public and Data API roles have no direct application-table grants'
);

select is(
  (
    select count(*)::integer
    from information_schema.routine_privileges
    where routine_schema = 'app_private'
      and grantee in ('PUBLIC', 'anon', 'authenticated', 'service_role')
  ),
  0,
  'public and Data API roles have no private-function grants'
);

select ok(
  not has_schema_privilege('anon', 'api', 'usage')
    and not has_schema_privilege('authenticated', 'api', 'usage')
    and not has_schema_privilege('service_role', 'api', 'usage')
    and not has_schema_privilege('anon', 'app_private', 'usage')
    and not has_schema_privilege('authenticated', 'app_private', 'usage')
    and not has_schema_privilege('service_role', 'app_private', 'usage'),
  'Data API roles cannot use locked application schemas'
);

select is(
  (
    select constraint_row.confdeltype::text
    from pg_constraint as constraint_row
    where constraint_row.conrelid = 'app_private.user_accounts'::regclass
      and constraint_row.confrelid = 'auth.users'::regclass
      and constraint_row.contype = 'f'
  ),
  'r',
  'deleting an Auth user is restricted while its application account exists'
);

select is(
  (
    select constraint_row.confdeltype::text
    from pg_constraint as constraint_row
    where constraint_row.conrelid = 'app_private.audit_events'::regclass
      and constraint_row.confrelid = 'auth.users'::regclass
      and constraint_row.contype = 'f'
  ),
  'n',
  'deleting an Auth user preserves audit events and nulls the actor reference'
);

select is(
  (
    select attribute.atttypmod
    from pg_attribute as attribute
    where attribute.attrelid = 'app_private.policy_chunk_embeddings'::regclass
      and attribute.attname = 'embedding'
      and not attribute.attisdropped
  ),
  -1,
  'embedding storage supports versioned profiles with variable dimensions'
);

select ok(
  exists (
    select 1
    from pg_trigger as trigger_row
    where trigger_row.tgrelid = 'app_private.embedding_profiles'::regclass
      and trigger_row.tgname = 'embedding_profiles_protect_identity'
      and not trigger_row.tgisinternal
  ),
  'embedding profile identity has an immutability trigger'
);

select ok(
  exists (
    select 1
    from pg_trigger as trigger_row
    where trigger_row.tgrelid = 'app_private.incident_revisions'::regclass
      and trigger_row.tgname = 'incident_revisions_immutable'
      and not trigger_row.tgisinternal
  )
  and exists (
    select 1
    from pg_trigger as trigger_row
    where trigger_row.tgrelid = 'app_private.report_revisions'::regclass
      and trigger_row.tgname = 'report_revisions_immutable'
      and not trigger_row.tgisinternal
  ),
  'incident and report revisions have immutability triggers'
);

select is(
  (select public::text from storage.buckets where id = 'policy-sources'),
  'false',
  'policy source bucket is private'
);

select is(
  (select public::text from storage.buckets where id = 'generated-exports'),
  'false',
  'generated export bucket is private'
);

select is(
  (
    select count(*)::integer
    from storage.buckets
    where (
      id = 'policy-sources'
      and file_size_limit = 52428800
      and cardinality(allowed_mime_types) = 2
      and allowed_mime_types @> array['application/pdf', 'text/plain']::text[]
    ) or (
      id = 'generated-exports'
      and file_size_limit = 52428800
      and cardinality(allowed_mime_types) = 3
      and allowed_mime_types @> array[
        'application/pdf',
        'application/zip',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ]::text[]
    )
  ),
  2,
  'private bucket size and MIME controls match the reviewed configuration'
);

select ok(
  exists (
    select 1
    from pg_trigger as trigger_row
    where trigger_row.tgrelid = 'app_private.user_accounts'::regclass
      and trigger_row.tgname = 'user_accounts_enforce_lifecycle'
      and not trigger_row.tgisinternal
  ),
  'user accounts have the lifecycle-enforcement trigger'
);

select ok(
  (
    select procedure.prosecdef
    from pg_proc as procedure
    join pg_namespace as namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'app_private'
      and procedure.proname = 'enforce_user_account_lifecycle'
      and pg_get_function_identity_arguments(procedure.oid) = ''
  ),
  'account lifecycle guard can enforce the last-admin rule despite forced RLS'
);

select lives_ok(
  $$
    insert into auth.users (id, email)
    values (
      '11111111-1111-4111-8111-111111111111',
      'fixture-one@example.invalid'
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
      '22222222-2222-4222-8222-222222222222',
      facility.id,
      repeat('a', 64),
      '11',
      'Fixture One',
      'active'
    from app_private.facilities as facility
    limit 1;

    insert into app_private.user_accounts (
      auth_user_id,
      staff_member_id,
      sign_in_alias,
      role,
      status,
      must_change_passcode
    )
    values (
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
      'fixture-one-auth-alias@example.invalid',
      'administrator',
      'active',
      false
    );
  $$,
  'a fictional sole active administrator can be created'
);

select throws_ok(
  $$
    update app_private.user_accounts
    set status = 'locked'
    where auth_user_id = '11111111-1111-4111-8111-111111111111';
  $$,
  'A locked account requires a future locked_until timestamp',
  'locking requires a future expiry'
);

select throws_ok(
  $$
    update app_private.user_accounts
    set status = 'disabled'
    where auth_user_id = '11111111-1111-4111-8111-111111111111';
  $$,
  'Cannot remove the last active administrator',
  'the final active administrator cannot be disabled'
);

select lives_ok(
  $$
    insert into auth.users (id, email)
    values (
      '33333333-3333-4333-8333-333333333333',
      'fixture-two@example.invalid'
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
      '44444444-4444-4444-8444-444444444444',
      facility.id,
      repeat('b', 64),
      '22',
      'Fixture Two',
      'active'
    from app_private.facilities as facility
    limit 1;

    insert into app_private.user_accounts (
      auth_user_id,
      staff_member_id,
      sign_in_alias,
      role,
      status,
      must_change_passcode
    )
    values (
      '33333333-3333-4333-8333-333333333333',
      '44444444-4444-4444-8444-444444444444',
      'fixture-two-auth-alias@example.invalid',
      'administrator',
      'active',
      false
    );
  $$,
  'a second fictional active administrator permits a lifecycle change'
);

select lives_ok(
  $$
    update app_private.user_accounts
    set status = 'disabled'
    where auth_user_id = '11111111-1111-4111-8111-111111111111';
  $$,
  'an administrator can be disabled when another active administrator remains'
);

select is(
  (
    select auth_version
    from app_private.user_accounts
    where auth_user_id = '11111111-1111-4111-8111-111111111111'
  ),
  2,
  'a security-relevant account state change advances auth_version'
);

select lives_ok(
  $$
    insert into app_private.incidents (
      id,
      facility_id,
      created_by_account_id,
      incident_number,
      display_name,
      occurred_at,
      category
    )
    select
      '55555555-5555-4555-8555-555555555555',
      facility.id,
      '33333333-3333-4333-8333-333333333333',
      'FICTIONAL-001',
      'Fictional training scenario',
      '2026-01-01T00:00:00Z'::timestamptz,
      'training'
    from app_private.facilities as facility
    limit 1;
  $$,
  'a fictional incident starts with revision head zero'
);

select throws_ok(
  $$
    insert into app_private.incident_revisions (
      incident_id,
      revision_number,
      editor_account_id,
      schema_version,
      field_notes,
      reviewed_facts
    )
    values (
      '55555555-5555-4555-8555-555555555555',
      2,
      '33333333-3333-4333-8333-333333333333',
      1,
      '[]'::jsonb,
      '[]'::jsonb
    );
  $$,
  'Incident revision must advance exactly one revision from the current head',
  'incident revisions cannot skip the current head'
);

select lives_ok(
  $$
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
      '66666666-6666-4666-8666-666666666666',
      '55555555-5555-4555-8555-555555555555',
      1,
      '33333333-3333-4333-8333-333333333333',
      1,
      '[]'::jsonb,
      '[]'::jsonb
    );
  $$,
  'the first immutable incident revision advances the head'
);

select is(
  (
    select current_revision_number
    from app_private.incidents
    where id = '55555555-5555-4555-8555-555555555555'
  ),
  1,
  'incident head matches the latest inserted revision'
);

select throws_ok(
  $$
    update app_private.incident_revisions
    set reason = 'rewritten'
    where id = '66666666-6666-4666-8666-666666666666';
  $$,
  'Rows in app_private.incident_revisions are append-only',
  'an incident revision cannot be rewritten after insertion'
);

select lives_ok(
  $$
    insert into app_private.reports (
      id,
      incident_id,
      report_type,
      reporting_account_id,
      prepared_by_account_id
    )
    values (
      '77777777-7777-4777-8777-777777777777',
      '55555555-5555-4555-8555-555555555555',
      'fictional_training_report',
      '33333333-3333-4333-8333-333333333333',
      '33333333-3333-4333-8333-333333333333'
    );
  $$,
  'a fictional report starts with revision head zero'
);

select throws_ok(
  $$
    insert into app_private.report_revisions (
      report_id,
      revision_number,
      editor_account_id,
      source_incident_revision_id,
      narrative,
      schema_version
    )
    values (
      '77777777-7777-4777-8777-777777777777',
      2,
      '33333333-3333-4333-8333-333333333333',
      '66666666-6666-4666-8666-666666666666',
      'Fictional training narrative.',
      1
    );
  $$,
  'Report revision must advance exactly one revision from the current head',
  'report revisions cannot skip the current head'
);

select lives_ok(
  $$
    insert into app_private.report_revisions (
      id,
      report_id,
      revision_number,
      editor_account_id,
      source_incident_revision_id,
      narrative,
      schema_version
    )
    values (
      '88888888-8888-4888-8888-888888888888',
      '77777777-7777-4777-8777-777777777777',
      1,
      '33333333-3333-4333-8333-333333333333',
      '66666666-6666-4666-8666-666666666666',
      'Fictional training narrative.',
      1
    );
  $$,
  'the first immutable report revision advances the head'
);

select is(
  (
    select current_revision_number
    from app_private.reports
    where id = '77777777-7777-4777-8777-777777777777'
  ),
  1,
  'report head matches the latest inserted revision'
);

select throws_ok(
  $$
    delete from app_private.report_revisions
    where id = '88888888-8888-4888-8888-888888888888';
  $$,
  'Rows in app_private.report_revisions are append-only',
  'a report revision cannot be deleted after insertion'
);

select * from finish();
rollback;
