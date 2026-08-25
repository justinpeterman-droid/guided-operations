begin;

select plan(38);

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

select * from finish();
rollback;
