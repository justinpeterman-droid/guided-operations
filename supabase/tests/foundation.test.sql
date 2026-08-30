begin;

select plan(225);

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
select has_table(
  'app_private',
  'incident_staff_relationships',
  'incident staff relationships table exists'
);
select has_table('app_private', 'reports', 'reports table exists');
select has_table('app_private', 'report_access', 'report access table exists');
select has_table('app_private', 'report_revisions', 'report revisions table exists');
select has_table(
  'app_private',
  'idempotency_records',
  'idempotency records table exists'
);
select has_table(
  'app_private',
  'auth_attempt_events',
  'private authentication attempt events table exists'
);
select has_table(
  'app_private',
  'admin_step_ups',
  'private administrator step-up proofs table exists'
);
select ok(
  exists (
    select 1
    from pg_proc as procedure
    join pg_namespace as namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'api'
      and procedure.proname = 'list_admin_accounts'
      and procedure.prosecdef
  ),
  'administrator account listing is a security-definer API routine'
);
select ok(
  has_function_privilege('authenticated', 'api.list_admin_accounts(integer)', 'execute')
  and not has_function_privilege('anon', 'api.list_admin_accounts(integer)', 'execute'),
  'only authenticated callers can execute the administrator account-list RPC'
);
select ok(
  not has_table_privilege('authenticated', 'app_private.user_accounts', 'select'),
  'an authenticated caller cannot read private accounts directly'
);
select ok(
  exists (
    select 1
    from pg_proc as procedure
    join pg_namespace as namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'api'
      and procedure.proname = 'list_admin_audit_events'
      and procedure.prosecdef
  ),
  'administrator audit listing is a security-definer API routine'
);
select ok(
  has_function_privilege('authenticated', 'api.list_admin_audit_events(integer)', 'execute')
  and not has_function_privilege('anon', 'api.list_admin_audit_events(integer)', 'execute'),
  'only authenticated callers can execute the administrator audit-list RPC'
);
select ok(
  not has_table_privilege('authenticated', 'app_private.audit_events', 'select'),
  'an authenticated caller cannot read private audit records directly'
);
select is(
  (select count(*)::integer from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='app_private' and p.proname in ('stage_invited_account','activate_invited_account','abandon_invited_account') and p.prosecdef),
  3,
  'private invitation lifecycle routines are security-definer only'
);
select ok(
  not has_function_privilege('authenticated','app_private.stage_invited_account(uuid,uuid,text,text,text,app_private.account_role,text,text,timestamp with time zone)','execute'),
  'authenticated callers cannot invoke private invitation staging directly'
);
select ok(
  not has_function_privilege('anon','app_private.activate_invited_account(uuid,uuid)','execute'),
  'anonymous callers cannot invoke private invitation activation'
);
select ok(
  not has_function_privilege('authenticated','app_private.change_account_shift(uuid,uuid,text)','execute'),
  'authenticated callers cannot invoke private shift changes directly'
);

select ok(
  exists (
    select 1
    from pg_proc as procedure
    join pg_namespace as namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'app_private'
      and procedure.proname = 'issue_admin_step_up'
      and procedure.prosecdef
  ),
  'administrator step-up issuance stays in a private security-definer routine'
);

select ok(
  exists (
    select 1
    from pg_proc as procedure
    join pg_namespace as namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'app_private'
      and procedure.proname = 'consume_admin_step_up'
      and procedure.prosecdef
  ),
  'administrator step-up consumption is an atomic private routine'
);

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
    and not has_schema_privilege('service_role', 'api', 'usage')
    and not has_schema_privilege('anon', 'app_private', 'usage')
    and not has_schema_privilege('authenticated', 'app_private', 'usage')
    and not has_schema_privilege('service_role', 'app_private', 'usage'),
  'Only authenticated users may use the reviewed API schema; private schemas remain locked'
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

select lives_ok(
  $$
    insert into auth.users (id, email)
    values ('77777777-7777-4777-8777-777777777777', 'fixture-disabled-officer@example.invalid');

    insert into app_private.staff_members (
      id, facility_id, employee_lookup_hash, employee_number_hint, display_name, status
    )
    select
      '88888888-8888-4888-8888-888888888888',
      facility.id,
      repeat('c', 64),
      '33',
      'Fixture Officer',
      'active'
    from app_private.facilities as facility
    limit 1;

    insert into app_private.user_accounts (
      auth_user_id, staff_member_id, sign_in_alias, role, status, must_change_passcode
    ) values (
      '77777777-7777-4777-8777-777777777777',
      '88888888-8888-4888-8888-888888888888',
      'fixture-officer-auth-alias@example.invalid',
      'officer',
      'active',
      false
    );

    select app_private.disable_account(
      '33333333-3333-4333-8333-333333333333',
      '77777777-7777-4777-8777-777777777777'
    );
  $$,
  'a current administrator can disable a same-facility fictional account through the private routine'
);

select is(
  (select status::text from app_private.user_accounts where auth_user_id = '77777777-7777-4777-8777-777777777777'),
  'disabled',
  'private account disablement changes the target state'
);

select throws_ok(
  $$
    select app_private.disable_account(
      '33333333-3333-4333-8333-333333333333',
      '33333333-3333-4333-8333-333333333333'
    );
  $$,
  'An administrator cannot disable their own account',
  'private account disablement rejects self-disablement'
);

select ok(
  not has_function_privilege('authenticated', 'app_private.disable_account(uuid,uuid)', 'execute'),
  'authenticated callers cannot invoke private account disablement directly'
);

select lives_ok(
  $$
    insert into auth.users (id, email)
    values ('99999999-9999-4999-8999-999999999999', 'fixture-locked-officer@example.invalid');
    insert into app_private.staff_members (
      id, facility_id, employee_lookup_hash, employee_number_hint, display_name, status
    )
    select '12121212-1212-4121-8121-121212121212', facility.id, repeat('d', 64), '44', 'Fixture Locked Officer', 'active'
    from app_private.facilities as facility limit 1;
    insert into app_private.user_accounts (
      auth_user_id, staff_member_id, sign_in_alias, role, status, locked_until, must_change_passcode
    ) values (
      '99999999-9999-4999-8999-999999999999',
      '12121212-1212-4121-8121-121212121212',
      'fixture-locked-officer-auth-alias@example.invalid', 'officer', 'locked', statement_timestamp() + interval '15 minutes', false
    );
    select app_private.unlock_account(
      '33333333-3333-4333-8333-333333333333',
      '99999999-9999-4999-8999-999999999999'
    );
  $$,
  'a current administrator can unlock a same-facility fictional locked account through the private routine'
);

select is(
  (select status::text from app_private.user_accounts where auth_user_id = '99999999-9999-4999-8999-999999999999'),
  'active',
  'private account unlock changes the target state to active'
);

select ok(
  not has_function_privilege('authenticated', 'app_private.unlock_account(uuid,uuid)', 'execute'),
  'authenticated callers cannot invoke private account unlock directly'
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
      'first_person',
      '33333333-3333-4333-8333-333333333333',
      '33333333-3333-4333-8333-333333333333'
    );
  $$,
  'a fictional report starts with revision head zero'
);

select throws_ok(
  $$
    insert into app_private.reports (
      id,
      incident_id,
      report_type,
      reporting_account_id,
      prepared_by_account_id
    )
    values (
      '76767676-7676-4676-8676-767676767676',
      '55555555-5555-4555-8555-555555555555',
      'invented_report_type',
      '33333333-3333-4333-8333-333333333333',
      '33333333-3333-4333-8333-333333333333'
    );
  $$,
  'new row for relation "reports" violates check constraint "reports_report_type_controlled_check"',
  'the database rejects a report outside the controlled report package'
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

select lives_ok(
  $$
    insert into app_private.idempotency_records (
      id,
      actor_account_id,
      action,
      idempotency_key_digest,
      request_digest,
      expires_at
    )
    values (
      '99999999-9999-4999-8999-999999999999',
      '33333333-3333-4333-8333-333333333333',
      'incident.create',
      repeat('c', 64),
      repeat('d', 64),
      statement_timestamp() + interval '10 minutes'
    );
  $$,
  'a fictional idempotency record starts pending without request content'
);

select throws_ok(
  $$
    update app_private.idempotency_records
    set request_digest = repeat('e', 64)
    where id = '99999999-9999-4999-8999-999999999999';
  $$,
  'Idempotency identity and request digest are immutable',
  'a retry key cannot be reused for a different request'
);

select lives_ok(
  $$
    update app_private.idempotency_records
    set status = 'succeeded',
        result_reference_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        result_code = 'incident.created'
    where id = '99999999-9999-4999-8999-999999999999';
  $$,
  'a pending idempotency record can resolve with only safe result metadata'
);

select throws_ok(
  $$
    update app_private.idempotency_records
    set status = 'failed',
        result_code = 'incident.failed'
    where id = '99999999-9999-4999-8999-999999999999';
  $$,
  'An idempotency record cannot change after completion',
  'a completed idempotency record cannot be reopened or repurposed'
);

select throws_ok(
  $$
    insert into app_private.idempotency_records (
      actor_account_id,
      action,
      idempotency_key_digest,
      request_digest,
      expires_at
    )
    values (
      '33333333-3333-4333-8333-333333333333',
      'incident.create',
      repeat('c', 64),
      repeat('d', 64),
      statement_timestamp() + interval '10 minutes'
    );
  $$,
  'duplicate key value violates unique constraint "idempotency_records_actor_account_id_action_idempotency_key_key"',
  'the same actor, action, and retry key cannot create a second record'
);

select lives_ok(
  $$
    insert into app_private.auth_attempt_events (
      subject_kind,
      subject_digest,
      outcome,
      expires_at
    ) values (
      'account',
      repeat('f', 64),
      'failed',
      statement_timestamp() + interval '10 minutes'
    );
  $$,
  'a rate-limit event stores only a fictional opaque subject digest'
);

select throws_ok(
  $$
    insert into app_private.auth_attempt_events (
      subject_kind,
      subject_digest,
      outcome,
      expires_at
    ) values (
      'account',
      'raw-employee-number',
      'failed',
      statement_timestamp() + interval '10 minutes'
    );
  $$,
  'new row for relation "auth_attempt_events" violates check constraint "auth_attempt_events_subject_digest_check"',
  'raw identifiers cannot enter auth rate-limit metadata'
);

select ok(
  has_function_privilege(
    'authenticated',
    'api.create_incident(uuid, text, text, timestamptz, text, integer, jsonb, jsonb, jsonb, text, text)',
    'execute'
  )
  and not has_function_privilege(
    'anon',
    'api.create_incident(uuid, text, text, timestamptz, text, integer, jsonb, jsonb, jsonb, text, text)',
    'execute'
  ),
  'only authenticated users can execute the reviewed incident-create RPC'
);

select ok(
  has_function_privilege('authenticated', 'api.list_staff_selection(integer)', 'execute')
  and not has_function_privilege('anon', 'api.list_staff_selection(integer)', 'execute'),
  'only authenticated users can request the minimal active staff selection list'
);

select ok(
  not has_table_privilege(
    'authenticated',
    'app_private.incident_staff_relationships',
    'select,insert,update,delete'
  ),
  'authenticated users cannot bypass relationship RPC validation'
);

select is(
  (
    select count(*)::integer
    from api.list_staff_selection(100)
    where is_current_account
  ),
  0,
  'a staff list without an authenticated active subject returns no current account'
);

select lives_ok(
  $$
    select set_config('app.test.facility_id', (select id::text from app_private.facilities limit 1), true);
    set local role authenticated;
    select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
    select api.create_incident(
      current_setting('app.test.facility_id')::uuid,
      'FICTIONAL-RPC-001',
      'Fictional RPC scenario',
      '2026-08-26T12:00:00Z'::timestamptz,
      'training',
      2,
      '[{"id":"12121212-1212-4121-8121-121212121212","text":"Fictional note from an RPC test.","recordedAt":"2026-08-26T12:00:00Z"}]'::jsonb,
      '[{"id":"13131313-1313-4131-8131-131313131313","field":"Fictional field","state":"confirmed","value":"Fictional value","sourceNoteIds":["12121212-1212-4121-8121-121212121212"],"reportingStaffMemberIds":["12121212-1212-4121-8121-121212121212"]}]'::jsonb,
      '[{"staffMemberId":"12121212-1212-4121-8121-121212121212","relationship":"reporting_officer"},{"staffMemberId":"44444444-4444-4444-8444-444444444444","relationship":"reporting_officer"},{"staffMemberId":"44444444-4444-4444-8444-444444444444","relationship":"preparer"}]'::jsonb,
      repeat('1', 64),
      repeat('2', 64)
    );
  $$,
  'an active authenticated account can create one fictional incident and revision'
);

reset role;

select is(
  (
    select count(*)::integer
    from app_private.incidents
    where incident_number = 'FICTIONAL-RPC-001'
  ),
  1,
  'the incident-create RPC created exactly one incident'
);

select is(
  (
    select count(*)::integer
    from app_private.incident_staff_relationships as relationship
    join app_private.incident_revisions as revision
      on revision.id = relationship.incident_revision_id
    join app_private.incidents as incident on incident.id = revision.incident_id
    where incident.incident_number = 'FICTIONAL-RPC-001'
  ),
  3,
  'incident creation recorded separate reporting and preparing relationships'
);

select throws_ok(
  $$
    select set_config('app.test.facility_id', (select id::text from app_private.facilities limit 1), true);
    set local role authenticated;
    select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
    select api.create_incident(
      current_setting('app.test.facility_id')::uuid,
      'FICTIONAL-RPC-WRONG-PREPARER',
      'Fictional wrong preparer scenario',
      '2026-08-26T12:00:00Z'::timestamptz,
      'training',
      2,
      '[{"id":"15151515-1515-4151-8151-151515151515","text":"Fictional note.","recordedAt":"2026-08-26T12:00:00Z"}]'::jsonb,
      '[]'::jsonb,
      '[{"staffMemberId":"44444444-4444-4444-8444-444444444444","relationship":"reporting_officer"},{"staffMemberId":"22222222-2222-4222-8222-222222222222","relationship":"preparer"}]'::jsonb,
      repeat('9', 64),
      repeat('8', 64)
    );
  $$,
  'Invalid incident staff relationships',
  'the browser cannot assign another employee as the preparing officer'
);

reset role;

select lives_ok(
  $$
    select set_config('app.test.facility_id', (select id::text from app_private.facilities limit 1), true);
    set local role authenticated;
    select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
    select api.create_incident(
      current_setting('app.test.facility_id')::uuid,
      'FICTIONAL-RPC-001',
      'Fictional RPC scenario',
      '2026-08-26T12:00:00Z'::timestamptz,
      'training',
      2,
      '[{"id":"12121212-1212-4121-8121-121212121212","text":"Fictional note from an RPC test.","recordedAt":"2026-08-26T12:00:00Z"}]'::jsonb,
      '[{"id":"13131313-1313-4131-8131-131313131313","field":"Fictional field","state":"confirmed","value":"Fictional value","sourceNoteIds":["12121212-1212-4121-8121-121212121212"],"reportingStaffMemberIds":["12121212-1212-4121-8121-121212121212"]}]'::jsonb,
      '[{"staffMemberId":"12121212-1212-4121-8121-121212121212","relationship":"reporting_officer"},{"staffMemberId":"44444444-4444-4444-8444-444444444444","relationship":"reporting_officer"},{"staffMemberId":"44444444-4444-4444-8444-444444444444","relationship":"preparer"}]'::jsonb,
      repeat('1', 64),
      repeat('2', 64)
    );
  $$,
  'a retry with the same request returns the existing incident'
);

reset role;

select is(
  (
    select count(*)::integer
    from app_private.incidents
    where incident_number = 'FICTIONAL-RPC-001'
  ),
  1,
  'the retry did not create a second incident'
);

select throws_ok(
  $$
    select set_config('app.test.facility_id', (select id::text from app_private.facilities limit 1), true);
    set local role authenticated;
    select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
    select api.create_incident(
      current_setting('app.test.facility_id')::uuid,
      'FICTIONAL-RPC-BAD-SCOPE',
      'Fictional invalid fact scope scenario',
      '2026-08-26T12:00:00Z'::timestamptz,
      'training',
      2,
      '[{"id":"16161616-1616-4161-8161-161616161616","text":"Fictional note.","recordedAt":"2026-08-26T12:00:00Z"}]'::jsonb,
      '[{"id":"17171717-1717-4171-8171-171717171717","field":"Fictional field","state":"confirmed","value":"Fictional value","sourceNoteIds":["16161616-1616-4161-8161-161616161616"],"reportingStaffMemberIds":["22222222-2222-4222-8222-222222222222"]}]'::jsonb,
      '[{"staffMemberId":"12121212-1212-4121-8121-121212121212","relationship":"reporting_officer"},{"staffMemberId":"44444444-4444-4444-8444-444444444444","relationship":"preparer"}]'::jsonb,
      repeat('b', 64),
      repeat('c', 64)
    );
  $$,
  'Invalid incident fact reporting scopes',
  'a client cannot scope a confirmed fact to staff who are not a selected reporting officer'
);

reset role;

select throws_ok(
  $$
    select set_config('app.test.facility_id', (select id::text from app_private.facilities limit 1), true);
    set local role authenticated;
    select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
    select api.create_incident(
      current_setting('app.test.facility_id')::uuid,
      'FICTIONAL-RPC-DENIED',
      'Fictional denied scenario',
      '2026-08-26T12:00:00Z'::timestamptz,
      'training',
      2,
      '[{"id":"14141414-1414-4141-8141-141414141414","text":"Fictional note.","recordedAt":"2026-08-26T12:00:00Z"}]'::jsonb,
      '[]'::jsonb,
      '[{"staffMemberId":"22222222-2222-4222-8222-222222222222","relationship":"reporting_officer"},{"staffMemberId":"22222222-2222-4222-8222-222222222222","relationship":"preparer"}]'::jsonb,
      repeat('3', 64),
      repeat('4', 64)
    );
  $$,
  'Not authorized to create an incident',
  'a disabled account cannot create an incident through direct RPC access'
);

reset role;

select ok(
  has_function_privilege('authenticated', 'api.current_account()', 'execute')
  and not has_function_privilege('anon', 'api.current_account()', 'execute'),
  'only authenticated users can execute the current-account RPC'
);

select lives_ok(
  $$
    set local role authenticated;
    select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
    select * from api.current_account();
  $$,
  'an authenticated account can retrieve only its own minimal account row'
);

reset role;

select ok(
  has_function_privilege(
    'authenticated',
    'api.store_report_draft_candidate(uuid, uuid, uuid, text, uuid[], jsonb, text, text, text)',
    'execute'
  )
  and not has_function_privilege(
    'anon',
    'api.store_report_draft_candidate(uuid, uuid, uuid, text, uuid[], jsonb, text, text, text)',
    'execute'
  ),
  'only authenticated users can store a reviewed report draft candidate'
);

select throws_ok(
  $$
    select set_config(
      'app.test.incident_id',
      (select id::text from app_private.incidents where incident_number = 'FICTIONAL-RPC-001'),
      true
    );
    select set_config(
      'app.test.revision_id',
      (
        select revision.id::text
        from app_private.incident_revisions as revision
        join app_private.incidents as incident on incident.id = revision.incident_id
        where incident.incident_number = 'FICTIONAL-RPC-001' and revision.revision_number = 1
      ),
      true
    );
    set local role authenticated;
    select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
    select api.store_report_draft_candidate(
      current_setting('app.test.incident_id')::uuid,
      current_setting('app.test.revision_id')::uuid,
      '22222222-2222-4222-8222-222222222222'::uuid,
      'first_person',
      array['13131313-1313-4131-8131-131313131313']::uuid[],
      '[{"text":"Fictional candidate paragraph.","sourceFactIds":["13131313-1313-4131-8131-131313131313"]}]'::jsonb,
      'fictional-provider-v1',
      repeat('5', 64), repeat('6', 64)
    );
  $$,
  'Not authorized to use one or more report facts',
  'a client cannot bind a draft to staff who are not a reporting officer on the source revision'
);

reset role;

select throws_ok(
  $$
    select set_config(
      'app.test.incident_id',
      (select id::text from app_private.incidents where incident_number = 'FICTIONAL-RPC-001'),
      true
    );
    select set_config(
      'app.test.revision_id',
      (
        select revision.id::text
        from app_private.incident_revisions as revision
        join app_private.incidents as incident on incident.id = revision.incident_id
        where incident.incident_number = 'FICTIONAL-RPC-001' and revision.revision_number = 1
      ),
      true
    );
    set local role authenticated;
    select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
    select api.store_report_draft_candidate(
      current_setting('app.test.incident_id')::uuid,
      current_setting('app.test.revision_id')::uuid,
      '44444444-4444-4444-8444-444444444444'::uuid,
      'first_person',
      array['13131313-1313-4131-8131-131313131313']::uuid[],
      '[{"text":"Fictional mismatched officer paragraph.","sourceFactIds":["13131313-1313-4131-8131-131313131313"]}]'::jsonb,
      'fictional-provider-v1',
      repeat('d', 64), repeat('e', 64)
    );
  $$,
  'Not authorized to use one or more report facts',
  'a draft cannot use a confirmed fact scoped only to another selected reporting officer'
);

reset role;

select lives_ok(
  $$
    select set_config(
      'app.test.incident_id',
      (select id::text from app_private.incidents where incident_number = 'FICTIONAL-RPC-001'),
      true
    );
    select set_config(
      'app.test.revision_id',
      (
        select revision.id::text
        from app_private.incident_revisions as revision
        join app_private.incidents as incident on incident.id = revision.incident_id
        where incident.incident_number = 'FICTIONAL-RPC-001' and revision.revision_number = 1
      ),
      true
    );
    set local role authenticated;
    select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
    select api.store_report_draft_candidate(
      current_setting('app.test.incident_id')::uuid,
      current_setting('app.test.revision_id')::uuid,
      '12121212-1212-4121-8121-121212121212'::uuid,
      'first_person',
      array['13131313-1313-4131-8131-131313131313']::uuid[],
      '[{"text":"Fictional candidate paragraph.","sourceFactIds":["13131313-1313-4131-8131-131313131313"]}]'::jsonb,
      'fictional-provider-v1',
      repeat('7', 64), repeat('8', 64)
    );
  $$,
  'an authorized owner can store one immutable provenance-validated fictional report draft candidate'
);

reset role;

select is(
  (select count(*)::integer from app_private.report_draft_candidates),
  1,
  'the report draft candidate is stored once as review-only history'
);

select ok(
  has_function_privilege(
    'authenticated',
    'api.get_report_draft_candidate(uuid)',
    'execute'
  )
  and not has_function_privilege(
    'anon',
    'api.get_report_draft_candidate(uuid)',
    'execute'
  ),
  'only authenticated users can read a report draft candidate'
);

select set_config(
  'app.test.candidate_id',
  (select id::text from app_private.report_draft_candidates limit 1),
  true
);
set local role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);

select lives_ok(
  $$ select * from api.get_report_draft_candidate(current_setting('app.test.candidate_id')::uuid) $$,
  'an authorized owner can read one immutable review-only report draft candidate'
);

reset role;

select ok(
  has_function_privilege(
    'authenticated',
    'api.finalize_report_draft_candidate(uuid, text, text, text)',
    'execute'
  )
  and not has_function_privilege(
    'anon',
    'api.finalize_report_draft_candidate(uuid, text, text, text)',
    'execute'
  ),
  'only authenticated users can explicitly finalize a reviewed report draft'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '99999999-9999-4999-8999-999999999999', true);
select lives_ok(
  $$ select api.finalize_report_draft_candidate(
    current_setting('app.test.candidate_id')::uuid,
    'Fictional human-reviewed final narrative.', repeat('b', 64), repeat('c', 64)
  ) $$,
  'an authorized human can create the first immutable report revision from a review-only candidate'
);
reset role;

select set_config(
  'app.test.report_id',
  (select id::text from app_private.reports order by created_at desc, id desc limit 1),
  true
);

select is(
  (select status::text from app_private.reports where id = current_setting('app.test.report_id')::uuid),
  'complete',
  'explicit human finalization creates a complete report rather than leaving generated material in draft state'
);

select is(
  (
    select reporting_account_id
    from app_private.reports
    where id = current_setting('app.test.report_id')::uuid
  ),
  '99999999-9999-4999-8999-999999999999'::uuid,
  'the finalized report is attributed to the selected reporting officer'
);

select is(
  (
    select prepared_by_account_id
    from app_private.reports
    where id = current_setting('app.test.report_id')::uuid
  ),
  '33333333-3333-4333-8333-333333333333'::uuid,
  'the finalized report separately records the account that prepared the candidate'
);

select is(
  (
    select editor_account_id
    from app_private.report_revisions
    where report_id = current_setting('app.test.report_id')::uuid
      and revision_number = 1
  ),
  '99999999-9999-4999-8999-999999999999'::uuid,
  'the immutable final revision separately records the account that finalized it'
);

select ok(
  has_function_privilege('authenticated', 'api.get_report(uuid)', 'execute')
  and not has_function_privilege('anon', 'api.get_report(uuid)', 'execute'),
  'only authenticated users can execute the report read RPC'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '99999999-9999-4999-8999-999999999999', true);
select lives_ok(
  $$ select * from api.get_report(current_setting('app.test.report_id')::uuid) $$,
  'an active report owner can read the current immutable report revision'
);
reset role;

select ok(
  has_function_privilege('authenticated', 'api.list_reports(integer)', 'execute')
  and not has_function_privilege('anon', 'api.list_reports(integer)', 'execute'),
  'only authenticated users can execute the report-list RPC'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '99999999-9999-4999-8999-999999999999', true);
select ok(
  exists (
    select 1
    from api.list_reports(50)
    where report_id = current_setting('app.test.report_id')::uuid
  ),
  'an active report owner can list the authorized finalized report summary'
);
reset role;

select ok(has_function_privilege('authenticated','api.append_report_revision(uuid,integer,text,text,text,text)','execute') and not has_function_privilege('anon','api.append_report_revision(uuid,integer,text,text,text,text)','execute'),'only authenticated users can append report revisions');
set local role authenticated;
select set_config('request.jwt.claim.sub','99999999-9999-4999-8999-999999999999',true);
select lives_ok($$ select api.append_report_revision(current_setting('app.test.report_id')::uuid,1,'Fictional corrected narrative.','Fictional correction.',repeat('d',64),repeat('e',64)) $$,'an authorized owner appends an immutable report correction');
reset role;
update app_private.report_access
set revoked_at = statement_timestamp()
where report_id = current_setting('app.test.report_id')::uuid
  and account_id = '33333333-3333-4333-8333-333333333333'::uuid;
set local role authenticated;
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
select throws_ok(
  $$ select api.append_report_revision(current_setting('app.test.report_id')::uuid,2,'Fictional administrator correction.','Fictional administrator reason.',repeat('4',64),repeat('5',64)) $$,
  'Not authorized to revise this report',
  'a same-facility administrator cannot revise an officer report without the future purpose-bound step-up workflow'
);
reset role;
update app_private.report_access
set revoked_at = null
where report_id = current_setting('app.test.report_id')::uuid
  and account_id = '33333333-3333-4333-8333-333333333333'::uuid;
set local role authenticated;
select set_config('request.jwt.claim.sub','99999999-9999-4999-8999-999999999999',true);
select is((select api.append_report_revision(current_setting('app.test.report_id')::uuid,1,'Fictional stale narrative.','Fictional stale correction.',repeat('f',64),repeat('1',64))),0,'a stale report revision returns a bounded conflict without overwriting the newer immutable revision');

reset role;
select ok(
  has_function_privilege('authenticated', 'api.list_report_revisions(uuid)', 'execute')
  and not has_function_privilege('anon', 'api.list_report_revisions(uuid)', 'execute'),
  'only authenticated users can execute the report-revision history RPC'
);
select ok(
  has_function_privilege('authenticated', 'api.restore_report_revision(uuid,integer,integer,text,text,text)', 'execute')
  and not has_function_privilege('anon', 'api.restore_report_revision(uuid,integer,integer,text,text,text)', 'execute'),
  'only authenticated users can execute the report-restore RPC'
);
set local role authenticated;
select set_config('request.jwt.claim.sub', '99999999-9999-4999-8999-999999999999', true);
select is(
  (select count(*)::integer from api.list_report_revisions(current_setting('app.test.report_id')::uuid)),
  2,
  'an authorized owner can see metadata for every immutable report revision'
);
select is(
  api.restore_report_revision(
    current_setting('app.test.report_id')::uuid,
    2,
    1,
    'Fictional restore after review.',
    repeat('2', 64),
    repeat('3', 64)
  ),
  3,
  'an authorized owner restores a prior revision by creating revision three'
);
select ok(
  exists (
    select 1
    from api.list_report_revisions(current_setting('app.test.report_id')::uuid)
    where revision_number = 3
      and is_current
      and restored_from_revision_number = 1
  ),
  'the restored revision records its immutable provenance and becomes the current head'
);
select is(
  api.restore_report_revision(
    current_setting('app.test.report_id')::uuid,
    3,
    1,
    'Fictional restore after review.',
    repeat('2', 64),
    repeat('3', 64)
  ),
  3,
  'a retry returns the exact restored revision rather than a later report head'
);

select ok(
  has_function_privilege(
    'authenticated',
    'api.record_report_print(uuid,integer,text,text,uuid)',
    'execute'
  )
  and not has_function_privilege(
    'anon',
    'api.record_report_print(uuid,integer,text,text,uuid)',
    'execute'
  ),
  'only authenticated users can record a report print request'
);

select lives_ok(
  $$
    select set_config(
      'app.test.report_print_event_id',
      api.record_report_print(
        current_setting('app.test.report_id')::uuid,
        3,
        repeat('4', 64),
        repeat('5', 64),
        '44444444-4444-4444-8444-444444444444'
      )::text,
      true
    );
  $$,
  'an authorized owner can record a redacted print request for the current report revision'
);

select is(
  api.record_report_print(
    current_setting('app.test.report_id')::uuid,
    3,
    repeat('4', 64),
    repeat('5', 64),
    '55555555-5555-4555-8555-555555555555'
  )::text,
  current_setting('app.test.report_print_event_id'),
  'a retried report print request returns the original audit event without duplication'
);

select throws_ok(
  $$
    select api.record_report_print(
      current_setting('app.test.report_id')::uuid,
      2,
      repeat('6', 64),
      repeat('7', 64),
      '66666666-6666-4666-8666-666666666666'
    );
  $$,
  'Report revision conflict',
  'a stale report revision cannot receive print authorization'
);

reset role;

select is(
  (
    select event_type
    from app_private.audit_events
    where event_id = current_setting('app.test.report_print_event_id')::uuid
  ),
  'report.print.requested',
  'the report output action is recorded as a request rather than claiming print completion'
);

select is(
  (
    select metadata::text
    from app_private.audit_events
    where event_id = current_setting('app.test.report_print_event_id')::uuid
  ),
  '{"action": "print", "revision_number": 3}',
  'the report print audit contains only the action and immutable revision number'
);

reset role;

select throws_ok(
  $$
    select set_config(
      'app.test.incident_id',
      (select id::text from app_private.incidents where incident_number = 'FICTIONAL-RPC-001'),
      true
    );
    select set_config(
      'app.test.revision_id',
      (
        select revision.id::text
        from app_private.incident_revisions as revision
        join app_private.incidents as incident on incident.id = revision.incident_id
        where incident.incident_number = 'FICTIONAL-RPC-001' and revision.revision_number = 1
      ),
      true
    );
    set local role authenticated;
    select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
    select api.store_report_draft_candidate(
      current_setting('app.test.incident_id')::uuid,
      current_setting('app.test.revision_id')::uuid,
      '12121212-1212-4121-8121-121212121212'::uuid,
      'first_person',
      array['77777777-7777-4777-8777-777777777777']::uuid[],
      '[{"text":"Fictional invalid paragraph.","sourceFactIds":["77777777-7777-4777-8777-777777777777"]}]'::jsonb,
      'fictional-provider-v1', repeat('9', 64), repeat('a', 64)
    );
  $$,
  'Not authorized to use one or more report facts',
  'a draft candidate cannot cite an unknown fact even through direct RPC access'
);

reset role;

select ok(
  has_function_privilege(
    'supabase_auth_admin',
    'app_private.custom_access_token_hook(jsonb)',
    'execute'
  )
  and not has_function_privilege(
    'authenticated',
    'app_private.custom_access_token_hook(jsonb)',
    'execute'
  )
  and not has_function_privilege(
    'anon',
    'app_private.custom_access_token_hook(jsonb)',
    'execute'
  ),
  'only the Supabase Auth administrator can execute the private token hook'
);

select is(
  (
    select app_private.custom_access_token_hook(
      jsonb_build_object(
        'user_id', '11111111-1111-4111-8111-111111111111',
        'claims', jsonb_build_object(
          'app_metadata', jsonb_build_object('auth_version', 999)
        )
      )
    )->'claims'->'app_metadata'->>'auth_version'
  ),
  '2',
  'the token hook overwrites a supplied auth version with the authoritative account version'
);

select ok(
  has_function_privilege('authenticated', 'api.list_incidents(integer)', 'execute')
  and not has_function_privilege('anon', 'api.list_incidents(integer)', 'execute'),
  'only authenticated users can execute the incident-list RPC'
);

select set_config(
  'app.test.incident_id',
  (select id::text from app_private.incidents where incident_number = 'FICTIONAL-RPC-001'),
  true
);
set local role authenticated;
select set_config('request.jwt.claim.sub', '', true);
reset role;

select is(
  (
    select count(*)::integer
    from api.list_incidents(100)
  ),
  0,
  'an authenticated request without a JWT subject receives no incident records'
);

reset role;

select lives_ok(
  $$
    set local role authenticated;
    select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
    select * from api.list_incidents(50);
  $$,
  'an active administrator can retrieve a summary-only authorized incident list'
);

reset role;

select throws_ok(
  $$ select * from api.list_incidents(0) $$,
  'Invalid incident list limit',
  'the incident-list RPC rejects unbounded or invalid page sizes'
);

select ok(
  has_function_privilege(
    'authenticated',
    'api.get_incident_revision(uuid, integer)',
    'execute'
  )
  and not has_function_privilege(
    'anon',
    'api.get_incident_revision(uuid, integer)',
    'execute'
  ),
  'only authenticated users can execute the incident-revision read RPC'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '', true);

select is(
  (
    select count(*)::integer
    from api.get_incident_revision(
      current_setting('app.test.incident_id')::uuid,
      1
    )
  ),
  0,
  'a request without a JWT subject cannot read an incident revision'
);

reset role;

select lives_ok(
  $$
    select set_config(
      'app.test.incident_id',
      (select id::text from app_private.incidents where incident_number = 'FICTIONAL-RPC-001'),
      true
    );
    set local role authenticated;
    select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
    select * from api.get_incident_revision(
      current_setting('app.test.incident_id')::uuid,
      1
    );
  $$,
  'an active administrator can read one immutable same-facility incident revision'
);

reset role;

select ok(
  has_function_privilege(
    'authenticated',
    'api.get_incident_report_workspace(uuid)',
    'execute'
  )
  and not has_function_privilege(
    'anon',
    'api.get_incident_report_workspace(uuid)',
    'execute'
  ),
  'only authenticated users can execute the incident report-workspace RPC'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '', true);

select is(
  (
    select count(*)::integer
    from api.get_incident_report_workspace(
      current_setting('app.test.incident_id')::uuid
    )
  ),
  0,
  'a request without a JWT subject cannot read a report workspace'
);

reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);

select is(
  (
    select count(*)::integer
    from api.get_incident_report_workspace(
      current_setting('app.test.incident_id')::uuid
    )
  ),
  1,
  'an active same-facility administrator can open the current report workspace'
);

select is(
  (
    select jsonb_array_length(workspace.reporting_officers)
    from api.get_incident_report_workspace(
      current_setting('app.test.incident_id')::uuid
    ) as workspace
  ),
  2,
  'the report workspace returns only the two active selected reporting officers'
);

select ok(
  (
    select not (to_jsonb(workspace) ? 'field_notes')
    from api.get_incident_report_workspace(
      current_setting('app.test.incident_id')::uuid
    ) as workspace
  ),
  'the report workspace never returns raw field notes'
);

reset role;

select lives_ok(
  $$
    insert into auth.users (id, email)
    values ('55555555-5555-4555-8555-555555555555', 'fixture-three@example.invalid');

    insert into app_private.staff_members (
      id, facility_id, employee_lookup_hash, employee_number_hint, display_name, status
    )
    select
      '66666666-6666-4666-8666-666666666666', facility.id, repeat('e', 64),
      '33', 'Fixture Three', 'active'
    from app_private.facilities as facility
    limit 1;

    insert into app_private.user_accounts (
      auth_user_id, staff_member_id, sign_in_alias, role, status, must_change_passcode
    ) values (
      '55555555-5555-4555-8555-555555555555',
      '66666666-6666-4666-8666-666666666666',
      'fixture-three-auth-alias@example.invalid', 'officer', 'active', false
    );
  $$,
  'a fictional unrelated active officer exists for direct revision-access denial testing'
);

select set_config(
  'app.test.incident_id',
  (select id::text from app_private.incidents where incident_number = 'FICTIONAL-RPC-001'),
  true
);
set local role authenticated;
select set_config('request.jwt.claim.sub', '55555555-5555-4555-8555-555555555555', true);

select is(
  (
    select count(*)::integer
    from api.get_incident_revision(
      current_setting('app.test.incident_id')::uuid,
      1
    )
  ),
  0,
  'an unrelated active officer cannot read another account’s incident revision through direct RPC access'
);

select is(
  (
    select count(*)::integer
    from api.get_incident_report_workspace(
      current_setting('app.test.incident_id')::uuid
    )
  ),
  0,
  'an unrelated active officer cannot open another account’s report workspace'
);

select is(
  (
    select count(*)::integer
    from api.get_report(current_setting('app.test.report_id')::uuid)
  ),
  0,
  'an unrelated active officer cannot read another account’s report through direct RPC access'
);

select is(
  (select count(*)::integer from api.list_reports(50)),
  0,
  'an unrelated active officer cannot list another account’s reports through direct RPC access'
);

select is(
  (
    select count(*)::integer
    from api.list_report_revisions(current_setting('app.test.report_id')::uuid)
  ),
  0,
  'an unrelated active officer cannot read another account’s report history through direct RPC access'
);

select throws_ok(
  $$
    select api.record_report_print(
      current_setting('app.test.report_id')::uuid,
      3,
      repeat('8', 64),
      repeat('9', 64),
      '88888888-8888-4888-8888-888888888888'
    );
  $$,
  'Not authorized to print this report',
  'an unrelated active officer cannot record a print request for another account report'
);

reset role;

select ok(
  has_function_privilege(
    'authenticated',
    'api.retrieve_policy_passages(text, integer)',
    'execute'
  )
  and not has_function_privilege(
    'anon',
    'api.retrieve_policy_passages(text, integer)',
    'execute'
  ),
  'only authenticated users can execute the policy-retrieval RPC'
);

select ok(
  has_function_privilege(
    'authenticated',
    'api.retrieve_policy_passages_v2(text, integer, uuid[])',
    'execute'
  )
  and not has_function_privilege(
    'anon',
    'api.retrieve_policy_passages_v2(text, integer, uuid[])',
    'execute'
  ),
  'only authenticated users can execute version-filtered policy retrieval'
);

select ok(
  has_function_privilege(
    'authenticated',
    'api.retrieve_policy_passages_v3(text, integer, uuid[], text[])',
    'execute'
  )
  and not has_function_privilege(
    'anon',
    'api.retrieve_policy_passages_v3(text, integer, uuid[], text[])',
    'execute'
  )
  and not has_function_privilege(
    'service_role',
    'api.retrieve_policy_passages_v3(text, integer, uuid[], text[])',
    'execute'
  ),
  'only authenticated users can execute collection-filtered policy retrieval'
);

select ok(
  has_function_privilege(
    'authenticated',
    'api.retrieve_policy_passages_v4(text,extensions.vector,text,integer,uuid[],text[])',
    'execute'
  )
  and not has_function_privilege(
    'anon',
    'api.retrieve_policy_passages_v4(text,extensions.vector,text,integer,uuid[],text[])',
    'execute'
  )
  and not has_function_privilege(
    'service_role',
    'api.retrieve_policy_passages_v4(text,extensions.vector,text,integer,uuid[],text[])',
    'execute'
  ),
  'only authenticated users can execute hybrid policy retrieval'
);

select lives_ok(
  $$
    insert into app_private.policy_documents (
      id, facility_id, stable_key, title, collection, status
    )
    select
      'abababab-abab-4bab-8bab-abababababab',
      facility.id,
      'fictional-policy-101',
      'Fictional Training Policy 101',
      'BMU policies',
      'approved'
    from app_private.facilities as facility
    limit 1;

    insert into app_private.policy_document_versions (
      id, document_id, version_label, source_sha256, storage_path, media_type,
      page_count, approved_at, indexed_at, source_filename, byte_size,
      rights_status, rights_evidence_ref, rights_reviewed_at,
      rights_reviewed_by,
      allowed_processing_regions, external_ai_allowed, lifecycle_status,
      is_current
    ) values (
      'bcbcbcbc-bcbc-4cbc-8cbc-bcbcbcbcbcbc',
      'abababab-abab-4bab-8bab-abababababab',
      'fictional-v1',
      repeat('a', 64),
      'opaque-fixture/' || repeat('a', 64) || '.pdf',
      'application/pdf',
      1,
      statement_timestamp(),
      statement_timestamp(),
      'fictional-training-policy.pdf',
      1024,
      'approved_internal_search',
      'fictional-rights-review-001',
      statement_timestamp(),
      (select staff.id from app_private.staff_members as staff limit 1),
      array['us-east-1'],
      true,
      'active',
      true
    );

    insert into app_private.policy_ingestion_runs (
      id, document_version_id, environment, source_sha256,
      collection, extraction_provider, extraction_tool, extraction_version,
      extraction_config_sha256, normalization_version, chunking_version,
      chunking_config_sha256, chunking_configuration, code_commit_sha,
      dependency_lock_sha256
    ) values (
      'dededede-dede-4ede-8ede-dededededede',
      'bcbcbcbc-bcbc-4cbc-8cbc-bcbcbcbcbcbc',
      'ci',
      repeat('a', 64),
      'BMU policies',
      'mineru',
      'fictional-parser',
      'fictional-v1',
      repeat('c', 64),
      'fictional-normalization-v1',
      'fictional-chunking-v1',
      repeat('1', 64),
      jsonb_build_object('max_pages', 2),
      repeat('d', 40),
      repeat('e', 64)
    );

    insert into app_private.policy_pages (
      document_version_id, ingestion_run_id, source_page_index,
      printed_page_label, normalized_text, normalized_text_sha256,
      extraction_mode, review_status
    ) values (
      'bcbcbcbc-bcbc-4cbc-8cbc-bcbcbcbcbcbc',
      'dededede-dede-4ede-8ede-dededededede',
      1,
      'Fictional 1',
      'Fictional procedure requires a documented review.',
      repeat('f', 64),
      'native',
      'approved'
    );

    insert into app_private.policy_chunks (
      id, document_version_id, ingestion_run_id, ordinal, page_start, page_end,
      printed_page_start, printed_page_end, section_path, content,
      content_sha256, lifecycle_status, qa_approved
    ) values (
      'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd',
      'bcbcbcbc-bcbc-4cbc-8cbc-bcbcbcbcbcbc',
      'dededede-dede-4ede-8ede-dededededede',
      0,
      1,
      1,
      'Fictional 1',
      'Fictional 1',
      'Fictional procedure',
      'Fictional procedure requires a documented review.',
      repeat('b', 64),
      'active',
      true
    );

    insert into app_private.policy_chunks (
      id, document_version_id, ingestion_run_id, ordinal, page_start, page_end,
      printed_page_start, printed_page_end, section_path, content,
      content_sha256, lifecycle_status, qa_approved
    ) values (
      'ecececec-ecec-4cec-8cec-ecececececec',
      'bcbcbcbc-bcbc-4cbc-8cbc-bcbcbcbcbcbc',
      'dededede-dede-4ede-8ede-dededededede',
      1,
      1,
      1,
      'Fictional 1',
      'Fictional 1',
      'Distinct access wording',
      'Distinctly worded access permissions apply.',
      repeat('8', 64),
      'active',
      true
    );

    insert into app_private.embedding_profiles (
      profile_key, provider, model, dimensions, enabled
    ) values (
      'fictional.openai-embedding-v1',
      'openai',
      'fictional-embedding-model',
      3,
      true
    );

    insert into app_private.policy_chunk_embeddings (
      policy_chunk_id, profile_key, embedding
    ) values
      (
        'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd',
        'fictional.openai-embedding-v1',
        '[0.7,0.7,0]'::extensions.vector
      ),
      (
        'ecececec-ecec-4cec-8cec-ecececececec',
        'fictional.openai-embedding-v1',
        '[1,0,0]'::extensions.vector
      );

    update app_private.policy_ingestion_runs
    set status = 'ready',
        qa_status = 'approved',
        qa_reviewed_by = (
          select staff.id from app_private.staff_members as staff limit 1
        ),
        qa_reviewed_at = statement_timestamp(),
        completed_at = statement_timestamp(),
        page_count = 1,
        chunk_count = 2
    where id = 'dededede-dede-4ede-8ede-dededededede';
  $$,
  'a fictional approved and indexed policy chunk can be staged for retrieval tests'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '', true);

select is(
  (select count(*)::integer from api.retrieve_policy_passages('fictional procedure', 8)),
  0,
  'an authenticated request without a JWT subject receives no policy passages'
);

select is(
  (
    select count(*)::integer
    from api.retrieve_policy_passages_v2(
      'fictional procedure',
      8,
      array['bcbcbcbc-bcbc-4cbc-8cbc-bcbcbcbcbcbc']::uuid[]
    )
  ),
  0,
  'version filtering cannot bypass the missing-account denial'
);

select is(
  (
    select count(*)::integer
    from api.retrieve_policy_passages_v3(
      'fictional procedure',
      8,
      null,
      array['BMU policies']::text[]
    )
  ),
  0,
  'collection filtering cannot bypass the missing-account denial'
);

select is(
  (
    select count(*)::integer
    from api.retrieve_policy_passages_v4(
      'fictional procedure',
      '[0.7,0.7,0]'::extensions.vector,
      'fictional.openai-embedding-v1',
      8,
      null,
      null
    )
  ),
  0,
  'hybrid retrieval cannot bypass the missing-account denial'
);

select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);

select set_config('request.jwt.claims', '{}', true);
select is(
  (select count(*)::integer from api.retrieve_policy_passages('fictional procedure', 8)),
  0,
  'policy retrieval denies a current subject whose JWT lacks an auth version'
);
select is(
  (select count(*)::integer from api.retrieve_policy_passages_v2('fictional procedure', 8, null)),
  0,
  'version-filtered retrieval denies a JWT without an auth version'
);

select set_config('request.jwt.claims', '{"app_metadata":{"auth_version":"1"}}', true);
select is(
  (select count(*)::integer from api.retrieve_policy_passages('fictional procedure', 8)),
  0,
  'policy retrieval denies a numeric-string auth-version claim'
);
select is(
  (select count(*)::integer from api.retrieve_policy_passages_v2('fictional procedure', 8, null)),
  0,
  'version-filtered retrieval denies a numeric-string auth-version claim'
);

select set_config('request.jwt.claims', '{"app_metadata":{"auth_version":999}}', true);
select is(
  (select count(*)::integer from api.retrieve_policy_passages('fictional procedure', 8)),
  0,
  'policy retrieval denies a stale auth-version claim after logout-all'
);
select is(
  (select count(*)::integer from api.retrieve_policy_passages_v2('fictional procedure', 8, null)),
  0,
  'version-filtered retrieval denies a stale auth-version claim after logout-all'
);

reset role;
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'app_metadata',
    jsonb_build_object(
      'auth_version',
      (select auth_version from app_private.user_accounts where auth_user_id = '33333333-3333-4333-8333-333333333333')
    )
  )::text,
  true
);
set local role authenticated;

select is(
  (select count(*)::integer from api.retrieve_policy_passages('fictional procedure', 8)),
  1,
  'an active current account receives only its approved indexed policy passage'
);

select is(
  (
    select count(*)::integer
    from api.retrieve_policy_passages_v2(
      'fictional procedure',
      8,
      array['bcbcbcbc-bcbc-4cbc-8cbc-bcbcbcbcbcbc']::uuid[]
    )
  ),
  1,
  'an explicit approved version filter returns its authorized passage'
);

select is(
  (
    select count(*)::integer
    from api.retrieve_policy_passages_v2(
      'fictional procedure',
      8,
      array['99999999-9999-4999-8999-999999999999']::uuid[]
    )
  ),
  0,
  'an explicit version filter cannot return a different version'
);

select is(
  (
    select collection
    from api.retrieve_policy_passages_v3('fictional procedure', 8, null, null)
  ),
  'BMU policies',
  'collection-aware retrieval returns the immutable registered collection'
);

select is(
  (
    select count(*)::integer
    from api.retrieve_policy_passages_v3(
      'fictional procedure',
      8,
      null,
      array['BMU policies']::text[]
    )
  ),
  1,
  'an exact collection filter returns its authorized passage'
);

select is(
  (
    select count(*)::integer
    from api.retrieve_policy_passages_v3(
      'fictional procedure',
      8,
      null,
      array['SD']::text[]
    )
  ),
  0,
  'a collection filter excludes passages from other collections'
);

select is(
  (
    select count(*)::integer
    from api.retrieve_policy_passages_v4(
      'fictional procedure',
      '[0.7,0.7,0]'::extensions.vector,
      'fictional.openai-embedding-v1',
      8,
      null,
      null
    )
  ),
  2,
  'hybrid retrieval fuses lexical and semantic candidates from the authorized corpus'
);

select is(
  (
    select chunk_id
    from api.retrieve_policy_passages_v4(
      'fictional procedure',
      '[0.7,0.7,0]'::extensions.vector,
      'fictional.openai-embedding-v1',
      1,
      null,
      null
    )
  ),
  'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd'::uuid,
  'deterministic rank fusion promotes a passage supported by both lexical and semantic rank'
);

select is(
  (
    select chunk_id
    from api.retrieve_policy_passages_v4(
      'authorization vocabulary',
      '[1,0,0]'::extensions.vector,
      'fictional.openai-embedding-v1',
      1,
      null,
      null
    )
  ),
  'ecececec-ecec-4cec-8cec-ecececececec'::uuid,
  'semantic rank can retrieve an authorized passage without an exact word match'
);

select is(
  (
    select count(*)::integer
    from api.retrieve_policy_passages_v4(
      'fictional procedure',
      '[0.7,0.7,0]'::extensions.vector,
      'fictional.openai-embedding-v1',
      8,
      null,
      array['SD']::text[]
    )
  ),
  0,
  'hybrid collection filtering cannot cross into another collection'
);

select throws_ok(
  $$
    select *
    from api.retrieve_policy_passages_v2(
      'fictional procedure',
      8,
      array[]::uuid[]
    );
  $$,
  'Invalid approved policy version filter',
  'an empty approved-version filter is rejected instead of widened'
);

select throws_ok(
  $$
    select *
    from api.retrieve_policy_passages_v3(
      'fictional procedure',
      8,
      null,
      array[]::text[]
    );
  $$,
  'Invalid policy collection filter',
  'an empty collection filter is rejected instead of widened'
);

select throws_ok(
  $$
    select *
    from api.retrieve_policy_passages_v3(
      'fictional procedure',
      8,
      null,
      array['Unknown collection']::text[]
    );
  $$,
  'Invalid policy collection filter',
  'an unknown collection filter is rejected'
);

select throws_ok(
  $$
    select *
    from api.retrieve_policy_passages_v4(
      'fictional procedure',
      '[0.7,0.7,0]'::extensions.vector,
      'fictional.openai-embedding-v1',
      8,
      null,
      array[]::text[]
    );
  $$,
  'Invalid policy collection filter',
  'hybrid retrieval rejects an empty collection filter instead of widening it'
);

select throws_ok(
  $$
    select *
    from api.retrieve_policy_passages_v4(
      'fictional procedure',
      '[0.7,0.7,0]'::extensions.vector,
      'unknown.embedding-profile',
      8,
      null,
      null
    );
  $$,
  'Invalid policy query embedding',
  'hybrid retrieval rejects an unknown or disabled embedding profile'
);

select throws_ok(
  $$
    select *
    from api.retrieve_policy_passages_v4(
      'fictional procedure',
      '[0.7,0.7]'::extensions.vector,
      'fictional.openai-embedding-v1',
      8,
      null,
      null
    );
  $$,
  'Invalid policy query embedding',
  'hybrid retrieval rejects a vector whose dimension does not match its profile'
);

select throws_ok(
  $$
    select *
    from api.retrieve_policy_passages_v4(
      'fictional procedure',
      '[0,0,0]'::extensions.vector,
      'fictional.openai-embedding-v1',
      8,
      null,
      null
    );
  $$,
  'Invalid policy query embedding',
  'hybrid retrieval rejects a zero query vector'
);

reset role;

update app_private.policy_document_versions
set external_ai_allowed = false,
    rights_status = 'expired_review'
where id = 'bcbcbcbc-bcbc-4cbc-8cbc-bcbcbcbcbcbc';

set local role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
select is(
  (select count(*)::integer from api.retrieve_policy_passages('fictional procedure', 8)),
  0,
  'retrieval excludes a policy version whose rights review expired'
);
select is(
  (
    select count(*)::integer
    from api.retrieve_policy_passages_v4(
      'fictional procedure',
      '[0.7,0.7,0]'::extensions.vector,
      'fictional.openai-embedding-v1',
      8,
      null,
      null
    )
  ),
  0,
  'hybrid retrieval excludes a policy version whose rights review expired'
);
reset role;

update app_private.policy_document_versions
set rights_status = 'approved_internal_search',
    external_ai_allowed = true
where id = 'bcbcbcbc-bcbc-4cbc-8cbc-bcbcbcbcbcbc';
update app_private.policy_ingestion_runs
set status = 'awaiting_review'
where id = 'dededede-dede-4ede-8ede-dededededede';

set local role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
select is(
  (select count(*)::integer from api.retrieve_policy_passages('fictional procedure', 8)),
  0,
  'retrieval excludes a policy ingestion run that is no longer ready'
);
reset role;

update app_private.policy_ingestion_runs
set status = 'ready'
where id = 'dededede-dede-4ede-8ede-dededededede';
select throws_ok(
  $$
    update app_private.policy_pages
    set review_status = 'pending'
    where ingestion_run_id = 'dededede-dede-4ede-8ede-dededededede'
  $$,
  'Move the policy ingestion run out of ready before changing its page or chunk evidence',
  'ready policy page evidence cannot be silently downgraded or changed'
);

select has_column(
  'app_private',
  'staff_members',
  'shift_code',
  'staff members retain the administrator-assigned Count Sheet shift code'
);

select lives_ok(
  $$
    update app_private.staff_members
    set shift_code = 'U'
    where id = '22222222-2222-4222-8222-222222222222';

    update app_private.staff_members
    set shift_code = 'F'
    where id = '44444444-4444-4444-8444-444444444444';
  $$,
  'five-day-week and five-day-week field assignments are accepted'
);

select throws_ok(
  $$
    update app_private.staff_members
    set shift_code = 'Z'
    where id = '22222222-2222-4222-8222-222222222222';
  $$,
  'new row for relation "staff_members" violates check constraint "staff_members_shift_code_check"',
  'an unapproved Count Sheet shift code is rejected'
);

select has_table(
  'app_private',
  'paperwork_records',
  'canonical paperwork head records exist'
);

select has_table(
  'app_private',
  'paperwork_revisions',
  'canonical immutable paperwork revisions exist'
);

select lives_ok(
  $$
    insert into app_private.paperwork_records (
      id, facility_id, kind, work_date, shift_code, created_by_account_id
    )
    select
      '77777777-7777-4777-8777-777777777777',
      facility.id,
      'count_sheet',
      date '2026-08-26',
      'A',
      '33333333-3333-4333-8333-333333333333'
    from app_private.facilities as facility
    limit 1;

    insert into app_private.paperwork_revisions (
      paperwork_record_id, revision_number, editor_account_id, reason,
      structure, payload, validation
    ) values (
      '77777777-7777-4777-8777-777777777777',
      1,
      '33333333-3333-4333-8333-333333333333',
      'Fictional initial Count Sheet.',
      app_private.approved_count_sheet_structure(),
      app_private.blank_approved_count_sheet_payload(),
      app_private.calculate_count_sheet_validation(
        app_private.approved_count_sheet_structure(),
        app_private.blank_approved_count_sheet_payload()
      )
    );
  $$,
  'a fictional Count Sheet creates its immutable first revision'
);

select is(
  (
    select current_revision_number
    from app_private.paperwork_records
    where id = '77777777-7777-4777-8777-777777777777'
  ),
  1,
  'the Count Sheet head advances only after the first immutable revision exists'
);

select throws_ok(
  $$
    insert into app_private.paperwork_revisions (
      paperwork_record_id, revision_number, editor_account_id, reason,
      structure, payload, validation
    ) values (
      '77777777-7777-4777-8777-777777777777',
      3,
      '33333333-3333-4333-8333-333333333333',
      'Fictional skipped revision.',
      app_private.approved_count_sheet_structure(),
      app_private.blank_approved_count_sheet_payload(),
      app_private.calculate_count_sheet_validation(
        app_private.approved_count_sheet_structure(),
        app_private.blank_approved_count_sheet_payload()
      )
    );
  $$,
  'Paperwork revision must advance exactly one revision from the current head',
  'a Count Sheet cannot skip immutable revision numbers'
);

select throws_ok(
  $$
    insert into app_private.paperwork_records (
      facility_id, kind, work_date, shift_code, created_by_account_id
    )
    select
      facility.id,
      'count_sheet',
      date '2026-08-26',
      'Z',
      '33333333-3333-4333-8333-333333333333'
    from app_private.facilities as facility
    limit 1;
  $$,
  'new row for relation "paperwork_records" violates check constraint "paperwork_records_shift_code_check"',
  'a Count Sheet cannot be created for an unapproved shift code'
);

select throws_ok(
  $$
    update app_private.paperwork_revisions
    set reason = 'Fictional altered history.'
    where paperwork_record_id = '77777777-7777-4777-8777-777777777777'
      and revision_number = 1;
  $$,
  'Rows in app_private.paperwork_revisions are append-only',
  'a Count Sheet revision cannot be altered after it is written'
);

select lives_ok(
  $$
    update app_private.staff_members
    set shift_code = 'B'
    where id = '66666666-6666-4666-8666-666666666666';
  $$,
  'a fictional officer can receive a different Count Sheet shift assignment'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '55555555-5555-4555-8555-555555555555', true);

select is(
  (select shift_code from api.current_account()),
  'B',
  'the current-account RPC returns the authenticated staff member assigned shift'
);

reset role;

select lives_ok(
  $$
    select app_private.change_account_shift(
      '33333333-3333-4333-8333-333333333333',
      '55555555-5555-4555-8555-555555555555',
      'U'
    );
  $$,
  'an active administrator can change a same-facility account shift'
);

select is(
  (
    select shift_code
    from app_private.staff_members
    where id = '66666666-6666-4666-8666-666666666666'
  ),
  'U',
  'the protected shift change updates the assigned staff shift'
);

select is(
  (
    select auth_version
    from app_private.user_accounts
    where auth_user_id = '55555555-5555-4555-8555-555555555555'
  ),
  2,
  'a shift authorization change revokes existing target sessions'
);

select is(
  (
    select (metadata->>'prior_shift_code') || ':' || (metadata->>'new_shift_code')
    from app_private.audit_events
    where event_type = 'account.shift.changed'
      and target_id = '55555555-5555-4555-8555-555555555555'
    order by occurred_at desc
    limit 1
  ),
  'B:U',
  'the shift-change audit contains only bounded prior and new shift codes'
);

update app_private.staff_members
set shift_code = 'B'
where id = '66666666-6666-4666-8666-666666666666';

set local role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);

select is(
  (
    select shift_code
    from api.list_admin_accounts(50)
    where account_id = '55555555-5555-4555-8555-555555555555'
  ),
  'B',
  'the administrator roster includes the assigned shift without exposing private credentials'
);

reset role;

select set_config(
  'app.test.count_structure',
  app_private.approved_count_sheet_structure()::text,
  true
);
select set_config(
  'app.test.count_payload_initial',
  jsonb_set(
    jsonb_set(
      jsonb_set(
        app_private.blank_approved_count_sheet_payload(),
        array['cells', 'Chow Hall', '1'],
        '2'::jsonb
      ),
      array['in_housing', '1'],
      '8'::jsonb
    ),
    array['operational', 'on_site'],
    '10'::jsonb
  )::text,
  true
);
select set_config(
  'app.test.count_payload_correction',
  jsonb_set(
    jsonb_set(
      jsonb_set(
        app_private.blank_approved_count_sheet_payload(),
        array['cells', 'Chow Hall', '1'],
        '1'::jsonb
      ),
      array['in_housing', '1'],
      '9'::jsonb
    ),
    array['operational', 'on_site'],
    '10'::jsonb
  )::text,
  true
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);

select is(
  (
    select count(*)::integer
    from api.list_count_sheets(date '2026-08-26')
  ),
  1,
  'an active same-facility administrator can list Count Sheet summaries'
);

select set_config('request.jwt.claim.sub', '55555555-5555-4555-8555-555555555555', true);

select is(
  (
    select count(*)::integer
    from api.list_count_sheets(date '2026-08-26')
  ),
  0,
  'an active officer cannot list another shift Count Sheet summary'
);

select is(
  (
    select count(*)::integer
    from api.get_count_sheet('77777777-7777-4777-8777-777777777777')
  ),
  0,
  'an active officer cannot read another shift Count Sheet values'
);

reset role;

select lives_ok(
  $$
    set local role authenticated;
    select set_config('request.jwt.claim.sub', '55555555-5555-4555-8555-555555555555', true);
    select *
    from api.save_count_sheet(
      date '2026-08-26',
      0,
      current_setting('app.test.count_structure')::jsonb,
      current_setting('app.test.count_payload_initial')::jsonb,
      'Fictional initial shared shift count.',
      repeat('c', 64),
      repeat('d', 64)
    );
  $$,
  'an active officer can create the first Count Sheet for their own shift'
);

reset role;

select is(
  (
    select revision.validation->>'reconciled'
    from app_private.paperwork_records as record
    join app_private.paperwork_revisions as revision
      on revision.paperwork_record_id = record.id
      and revision.revision_number = record.current_revision_number
    where record.work_date = date '2026-08-26'
      and record.shift_code = 'B'
  ),
  'true',
  'the Count Sheet reconciliation is derived from entered values in the database'
);

select set_config(
  'app.test.count_record_id',
  (
    select id::text
    from app_private.paperwork_records
    where work_date = date '2026-08-26'
      and shift_code = 'B'
      and archived_at is null
  ),
  true
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '55555555-5555-4555-8555-555555555555', true);

select lives_ok(
  $$
    select *
    from api.save_count_sheet(
      date '2026-08-26',
      1,
      current_setting('app.test.count_structure')::jsonb,
      current_setting('app.test.count_payload_correction')::jsonb,
      'Fictional shift correction.',
      repeat('e', 64),
      repeat('f', 64)
    );
  $$,
  'an active officer can append the next revision for their own shift'
);

select throws_ok(
  $$
    select *
    from api.save_count_sheet(
      date '2026-08-26',
      1,
      current_setting('app.test.count_structure')::jsonb,
      current_setting('app.test.count_payload_correction')::jsonb,
      'Fictional stale correction.',
      repeat('1', 64),
      repeat('2', 64)
    );
  $$,
  'Count Sheet revision conflict',
  'a stale Count Sheet save cannot overwrite a newer revision'
);

select throws_ok(
  $$
    select *
    from api.save_count_sheet(
      date '2026-08-26',
      2,
      '{"schema_version": 1, "title": "Unapproved", "columns": ["1"], "areas": ["Dining"], "operational_fields": ["on_site"], "attachment_reminders": []}',
      '{"schema_version": 1, "count_started": null, "count_ended": null, "cells": {"Dining": {"1": 1}}, "in_housing": {"1": 9}, "operational": {"on_site": 10}}',
      'Fictional unapproved structure attempt.',
      repeat('3', 64),
      repeat('4', 64)
    );
  $$,
  'Count Sheet structure is not the approved form',
  'direct RPC access cannot save a different Count Sheet structure'
);

select is(
  (
    select count(*)::integer
    from api.list_count_sheet_revisions(
      current_setting('app.test.count_record_id')::uuid
    )
  ),
  2,
  'a same-shift officer can list immutable Count Sheet revision history'
);

select is(
  (
    select payload #>> array['cells', 'Chow Hall', '1']
    from api.get_count_sheet_revision(
      current_setting('app.test.count_record_id')::uuid,
      1
    )
  ),
  '2',
  'a same-shift officer can inspect an earlier Count Sheet snapshot'
);

select lives_ok(
  $$
    select api.restore_count_sheet_revision(
      current_setting('app.test.count_record_id')::uuid,
      2,
      1,
      'Restore the first fictional reviewed count.',
      repeat('5', 64),
      repeat('6', 64)
    );
  $$,
  'a same-shift officer can restore an earlier Count Sheet as a new revision'
);

select is(
  (
    select payload #>> array['cells', 'Chow Hall', '1']
    from api.get_count_sheet_revision(
      current_setting('app.test.count_record_id')::uuid,
      3
    )
  ),
  '2',
  'the restored Count Sheet copies the selected immutable snapshot'
);

select is(
  (
    select restored_from_revision_number
    from api.get_count_sheet_revision(
      current_setting('app.test.count_record_id')::uuid,
      3
    )
  ),
  1,
  'the restored Count Sheet records its source revision provenance'
);

select throws_ok(
  $$
    select api.restore_count_sheet_revision(
      current_setting('app.test.count_record_id')::uuid,
      2,
      1,
      'Fictional stale restore.',
      repeat('7', 64),
      repeat('8', 64)
    );
  $$,
  'Count Sheet revision conflict',
  'a stale Count Sheet restore cannot overwrite the newer head'
);

select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);

select is(
  (
    select count(*)::integer
    from api.list_count_sheet_revisions(
      current_setting('app.test.count_record_id')::uuid
    )
  ),
  3,
  'a same-facility administrator can inspect Count Sheet history for oversight'
);

select throws_ok(
  $$
    select api.restore_count_sheet_revision(
      current_setting('app.test.count_record_id')::uuid,
      3,
      1,
      'Cross-shift restore attempt.',
      repeat('9', 64),
      repeat('a', 64)
    );
  $$,
  'Not authorized to restore this Count Sheet',
  'an administrator cannot restore a Count Sheet outside their assigned shift'
);

select set_config('request.jwt.claim.sub', '55555555-5555-4555-8555-555555555555', true);

select lives_ok(
  $$
    select set_config(
      'app.test.count_print_event_id',
      api.record_count_sheet_print(
        current_setting('app.test.count_record_id')::uuid,
        3,
        repeat('b', 64),
        repeat('c', 64),
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
      )::text,
      true
    );
  $$,
  'a same-shift officer can record a redacted print request for the current saved revision'
);

select is(
  api.record_count_sheet_print(
    current_setting('app.test.count_record_id')::uuid,
    3,
    repeat('b', 64),
    repeat('c', 64),
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  )::text,
  current_setting('app.test.count_print_event_id'),
  'a retried print request returns the original audit event without duplication'
);

select throws_ok(
  $$
    select api.record_count_sheet_print(
      current_setting('app.test.count_record_id')::uuid,
      2,
      repeat('d', 64),
      repeat('e', 64),
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
    );
  $$,
  'Count Sheet revision conflict',
  'a stale Count Sheet revision cannot receive print authorization'
);

select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);

select throws_ok(
  $$
    select api.record_count_sheet_print(
      current_setting('app.test.count_record_id')::uuid,
      3,
      repeat('f', 64),
      repeat('0', 64),
      'ffffffff-ffff-4fff-8fff-ffffffffffff'
    );
  $$,
  'Not authorized to print this Count Sheet',
  'an administrator cannot print a Count Sheet outside their assigned shift'
);

reset role;

select is(
  (
    select event_type
    from app_private.audit_events
    where event_id = current_setting('app.test.count_print_event_id')::uuid
  ),
  'count_sheet.print.requested',
  'the deliberate print action is recorded as a request rather than claiming output completion'
);

select is(
  (
    select metadata::text
    from app_private.audit_events
    where event_id = current_setting('app.test.count_print_event_id')::uuid
  ),
  '{"action": "print", "revision_number": 3}',
  'the Count Sheet print audit contains only the action and immutable revision number'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '55555555-5555-4555-8555-555555555555', true);

select throws_ok(
  $$
    select * from app_private.paperwork_records;
  $$,
  'permission denied for schema app_private',
  'an authenticated caller cannot bypass the Count Sheet API through head records'
);

select throws_ok(
  $$
    select * from app_private.paperwork_revisions;
  $$,
  'permission denied for schema app_private',
  'an authenticated caller cannot bypass the Count Sheet API through revisions'
);

reset role;

select * from finish();
rollback;
