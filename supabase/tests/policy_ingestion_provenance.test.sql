begin;

select plan(23);

select has_table(
  'app_private',
  'policy_ingestion_runs',
  'policy ingestion runs are recorded privately'
);
select has_table(
  'app_private',
  'policy_pages',
  'policy page evidence is recorded privately'
);
select has_column(
  'app_private',
  'policy_document_versions',
  'rights_status',
  'policy versions record a rights decision'
);
select has_column(
  'app_private',
  'policy_document_versions',
  'external_ai_allowed',
  'policy versions record external AI permission'
);
select has_column(
  'app_private',
  'policy_document_versions',
  'is_current',
  'policy versions record the reviewed current version'
);
select has_column(
  'app_private',
  'policy_chunks',
  'ingestion_run_id',
  'policy chunks identify their exact ingestion run'
);
select has_column(
  'app_private',
  'policy_chunks',
  'qa_approved',
  'policy chunks record QA approval'
);

select is(
  (
    select relrowsecurity and relforcerowsecurity
    from pg_class
    where oid = 'app_private.policy_ingestion_runs'::regclass
  ),
  true,
  'policy ingestion runs enable and force RLS'
);
select is(
  (
    select relrowsecurity and relforcerowsecurity
    from pg_class
    where oid = 'app_private.policy_pages'::regclass
  ),
  true,
  'policy pages enable and force RLS'
);

select ok(
  not has_table_privilege('anon', 'app_private.policy_ingestion_runs', 'select')
  and not has_table_privilege('authenticated', 'app_private.policy_ingestion_runs', 'select')
  and not has_table_privilege('service_role', 'app_private.policy_ingestion_runs', 'select'),
  'runtime roles cannot directly read policy ingestion evidence'
);
select ok(
  not has_table_privilege('anon', 'app_private.policy_pages', 'select')
  and not has_table_privilege('authenticated', 'app_private.policy_pages', 'select')
  and not has_table_privilege('service_role', 'app_private.policy_pages', 'select'),
  'runtime roles cannot directly read extracted policy pages'
);

select lives_ok(
  $$
    insert into app_private.policy_documents (
      id, facility_id, stable_key, title, collection, status
    )
    select
      '10101010-1010-4010-8010-101010101010',
      facility.id,
      'fictional-provenance-policy',
      'Fictional Provenance Policy',
      'BMU Post Orders',
      'approved'
    from app_private.facilities as facility
    limit 1;

    insert into app_private.staff_members (
      id, facility_id, employee_lookup_hash, employee_number_hint,
      display_name, status
    )
    select
      '15151515-1515-4515-8515-151515151515',
      facility.id,
      repeat('0', 64),
      'FICT-01',
      'Fictional Policy Reviewer',
      'active'
    from app_private.facilities as facility
    limit 1;

    insert into app_private.policy_document_versions (
      id, document_id, version_label, source_sha256, storage_path, media_type,
      page_count, approved_at, indexed_at, source_filename, byte_size,
      rights_status, rights_evidence_ref, rights_reviewed_by,
      rights_reviewed_at, allowed_processing_regions,
      external_ai_allowed, lifecycle_status, is_current
    ) values (
      '20202020-2020-4020-8020-202020202020',
      '10101010-1010-4010-8010-101010101010',
      'fictional-v1',
      repeat('1', 64),
      'fictional-provenance/' || repeat('1', 64) || '.pdf',
      'application/pdf',
      2,
      statement_timestamp(),
      statement_timestamp(),
      'fictional-provenance-policy.pdf',
      2048,
      'approved_internal_search',
      'fictional-rights-evidence',
      '15151515-1515-4515-8515-151515151515',
      statement_timestamp(),
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
      '30303030-3030-4030-8030-303030303030',
      '20202020-2020-4020-8020-202020202020',
      'ci',
      repeat('1', 64),
      'BMU Post Orders',
      'mineru',
      'fictional-parser',
      'fictional-v1',
      repeat('2', 64),
      'fictional-normalization-v1',
      'fictional-chunking-v1',
      repeat('a', 64),
      jsonb_build_object('max_pages', 2),
      repeat('3', 40),
      repeat('4', 64)
    );

    insert into app_private.policy_pages (
      document_version_id, ingestion_run_id, source_page_index,
      normalized_text, normalized_text_sha256, extraction_mode, review_status
    ) values
      (
        '20202020-2020-4020-8020-202020202020',
        '30303030-3030-4030-8030-303030303030',
        1,
        'Fictional first page.',
        repeat('5', 64),
        'native',
        'approved'
      ),
      (
        '20202020-2020-4020-8020-202020202020',
        '30303030-3030-4030-8030-303030303030',
        2,
        'Fictional second page.',
        repeat('6', 64),
        'native',
        'approved'
      );

    insert into app_private.policy_chunks (
      id, document_version_id, ingestion_run_id, ordinal, page_start, page_end,
      content, content_sha256, lifecycle_status, qa_approved
    ) values (
      '40404040-4040-4040-8040-404040404040',
      '20202020-2020-4020-8020-202020202020',
      '30303030-3030-4030-8030-303030303030',
      0,
      1,
      2,
      'Fictional bounded policy passage.',
      repeat('7', 64),
      'active',
      true
    );

    update app_private.policy_ingestion_runs
    set status = 'ready',
        qa_status = 'approved',
        qa_reviewed_by = '15151515-1515-4515-8515-151515151515',
        qa_reviewed_at = statement_timestamp(),
        completed_at = statement_timestamp(),
        page_count = 2,
        chunk_count = 1
    where id = '30303030-3030-4030-8030-303030303030';
  $$,
  'a fully fictional source, run, page map, and chunk can be recorded'
);

select is(
  (
    select count(*)::integer
    from app_private.policy_pages
    where ingestion_run_id = '30303030-3030-4030-8030-303030303030'
  ),
  2,
  'the fictional ingestion run has two bounded source pages'
);

select throws_ok(
  $$
    update app_private.policy_ingestion_runs
    set extraction_version = 'fictional-mutated-v2'
    where id = '30303030-3030-4030-8030-303030303030'
  $$,
  'Policy ingestion identity is immutable; create a new run instead',
  'an accepted ingestion run cannot rewrite its tool identity'
);

select throws_ok(
  $$
    insert into app_private.policy_ingestion_runs (
      document_version_id, environment, source_sha256,
      collection, extraction_provider, extraction_tool, extraction_version,
      extraction_config_sha256, normalization_version, chunking_version,
      chunking_config_sha256, chunking_configuration, code_commit_sha,
      dependency_lock_sha256
    ) values (
      '20202020-2020-4020-8020-202020202020',
      'ci',
      repeat('8', 64),
      'BMU Post Orders',
      'mineru',
      'fictional-parser',
      'fictional-v1',
      repeat('2', 64),
      'fictional-normalization-v1',
      'fictional-chunking-v1',
      repeat('a', 64),
      jsonb_build_object('max_pages', 2),
      repeat('3', 40),
      repeat('4', 64)
    )
  $$,
  'Ingestion source hash does not match the immutable policy version',
  'an ingestion run cannot claim a different source hash'
);

select throws_ok(
  $$
    insert into app_private.policy_chunks (
      document_version_id, ordinal, page_start, page_end,
      content, content_sha256
    ) values (
      '20202020-2020-4020-8020-202020202020',
      1,
      1,
      1,
      'Fictional untracked passage.',
      repeat('9', 64)
    )
  $$,
  'New policy chunks require an ingestion run and bounded source pages',
  'a new policy chunk cannot omit its ingestion run'
);

select throws_ok(
  $$
    insert into app_private.policy_chunks (
      document_version_id, ingestion_run_id, ordinal, page_start, page_end,
      content, content_sha256
    ) values (
      '20202020-2020-4020-8020-202020202020',
      '30303030-3030-4030-8030-303030303030',
      1,
      1,
      3,
      'Fictional missing-page passage.',
      repeat('a', 64)
    )
  $$,
  'Policy chunk source-page range is incomplete',
  'a policy chunk cannot cite a page absent from its ingestion run'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'app_private.policy_chunks'::regclass
      and conname = 'policy_chunks_page_span_check'
  ),
  'a policy chunk cannot span more than ten source pages'
);

select throws_ok(
  $$
    update app_private.policy_document_versions
    set external_ai_allowed = true,
        rights_status = 'restricted_provider'
    where id = '20202020-2020-4020-8020-202020202020'
  $$,
  '23514',
  null,
  'external AI use requires an approved rights state'
);

select throws_ok(
  $$
    insert into app_private.policy_document_versions (
      document_id, version_label, source_sha256, storage_path, media_type,
      is_current
    ) values (
      '10101010-1010-4010-8010-101010101010',
      'fictional-v2',
      repeat('c', 64),
      'fictional-provenance/' || repeat('c', 64) || '.pdf',
      'application/pdf',
      true
    )
  $$,
  '23505',
  null,
  'only one policy version can be marked current per policy family'
);

select is(
  (
    select count(*)::integer
    from api.retrieve_policy_passages('fictional bounded policy', 8)
  ),
  0,
  'policy retrieval returns no passages without an active authenticated account'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'app_private.policy_chunks'::regclass
      and conname = 'policy_chunks_start_page_fkey'
  ),
  'policy chunks have a database-enforced start-page reference'
);
select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'app_private.policy_chunks'::regclass
      and conname = 'policy_chunks_end_page_fkey'
  ),
  'policy chunks have a database-enforced end-page reference'
);

select * from finish();

rollback;
