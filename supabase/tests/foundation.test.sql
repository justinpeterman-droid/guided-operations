begin;

select plan(88);

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
    'api.create_incident(uuid, text, text, timestamptz, text, integer, jsonb, jsonb, text, text)',
    'execute'
  )
  and not has_function_privilege(
    'anon',
    'api.create_incident(uuid, text, text, timestamptz, text, integer, jsonb, jsonb, text, text)',
    'execute'
  ),
  'only authenticated users can execute the reviewed incident-create RPC'
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
      1,
      '[{"id":"12121212-1212-4121-8121-121212121212","text":"Fictional note from an RPC test.","recordedAt":"2026-08-26T12:00:00Z"}]'::jsonb,
      '[{"id":"13131313-1313-4131-8131-131313131313","field":"Fictional field","state":"confirmed","value":"Fictional value","sourceNoteIds":["12121212-1212-4121-8121-121212121212"]}]'::jsonb,
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
      1,
      '[{"id":"12121212-1212-4121-8121-121212121212","text":"Fictional note from an RPC test.","recordedAt":"2026-08-26T12:00:00Z"}]'::jsonb,
      '[{"id":"13131313-1313-4131-8131-131313131313","field":"Fictional field","state":"confirmed","value":"Fictional value","sourceNoteIds":["12121212-1212-4121-8121-121212121212"]}]'::jsonb,
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
    select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
    select api.create_incident(
      current_setting('app.test.facility_id')::uuid,
      'FICTIONAL-RPC-DENIED',
      'Fictional denied scenario',
      '2026-08-26T12:00:00Z'::timestamptz,
      'training',
      1,
      '[{"id":"14141414-1414-4141-8141-141414141414","text":"Fictional note.","recordedAt":"2026-08-26T12:00:00Z"}]'::jsonb,
      '[]'::jsonb,
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
    'api.store_report_draft_candidate(uuid, uuid, text, uuid[], jsonb, text, text, text)',
    'execute'
  )
  and not has_function_privilege(
    'anon',
    'api.store_report_draft_candidate(uuid, uuid, text, uuid[], jsonb, text, text, text)',
    'execute'
  ),
  'only authenticated users can store a reviewed report draft candidate'
);

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
      'fictional-training-report',
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
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
select lives_ok(
  $$ select api.finalize_report_draft_candidate(
    current_setting('app.test.candidate_id')::uuid,
    'Fictional human-reviewed final narrative.', repeat('b', 64), repeat('c', 64)
  ) $$,
  'an authorized human can create the first immutable report revision from a review-only candidate'
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
      'fictional-training-report',
      array['77777777-7777-4777-8777-777777777777']::uuid[],
      '[{"text":"Fictional invalid paragraph.","sourceFactIds":["77777777-7777-4777-8777-777777777777"]}]'::jsonb,
      'fictional-provider-v1', repeat('9', 64), repeat('a', 64)
    );
  $$,
  'Report draft source contains an unconfirmed fact',
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

select lives_ok(
  $$
    insert into app_private.policy_documents (
      id, facility_id, stable_key, title, status
    )
    select
      'abababab-abab-4bab-8bab-abababababab',
      facility.id,
      'fictional-policy-101',
      'Fictional Training Policy 101',
      'approved'
    from app_private.facilities as facility
    limit 1;

    insert into app_private.policy_document_versions (
      id, document_id, version_label, source_sha256, storage_path, media_type,
      page_count, approved_at, indexed_at
    ) values (
      'bcbcbcbc-bcbc-4cbc-8cbc-bcbcbcbcbcbc',
      'abababab-abab-4bab-8bab-abababababab',
      'fictional-v1',
      repeat('a', 64),
      'opaque-fixture/' || repeat('a', 64) || '.pdf',
      'application/pdf',
      1,
      statement_timestamp(),
      statement_timestamp()
    );

    insert into app_private.policy_chunks (
      id, document_version_id, ordinal, page_start, page_end, section_path,
      content, content_sha256
    ) values (
      'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd',
      'bcbcbcbc-bcbc-4cbc-8cbc-bcbcbcbcbcbc',
      0,
      1,
      1,
      'Fictional procedure',
      'Fictional procedure requires a documented review.',
      repeat('b', 64)
    );
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

select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);

select is(
  (select count(*)::integer from api.retrieve_policy_passages('fictional procedure', 8)),
  1,
  'an active current account receives only its approved indexed policy passage'
);

reset role;

select * from finish();
rollback;
