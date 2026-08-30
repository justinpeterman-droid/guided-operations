begin;

select plan(21);

select has_type('app_private', 'policy_collection', 'canonical policy collection type exists');
select is(
  (
    select array_agg(enum.enumlabel order by enum.enumsortorder)::text
    from pg_enum as enum
    join pg_type as type on type.oid = enum.enumtypid
    join pg_namespace as namespace on namespace.oid = type.typnamespace
    where namespace.nspname = 'app_private' and type.typname = 'policy_collection'
  ),
  array['BMU policies', 'BMU Post Orders', 'SD']::text,
  'collection values exactly match the approved source folders'
);
select has_column('app_private', 'policy_documents', 'collection', 'policy registry stores collection explicitly');
select has_column('app_private', 'policy_ingestion_runs', 'collection', 'ingestion runs preserve collection');
select has_column('app_private', 'policy_ingestion_runs', 'source_filename', 'ingestion runs preserve the source filename');
select has_column('app_private', 'policy_ingestion_runs', 'extraction_provider', 'ingestion runs name the extraction provider');
select has_column('app_private', 'policy_ingestion_runs', 'extraction_model_version', 'ingestion runs preserve extraction model version');
select has_column('app_private', 'policy_ingestion_runs', 'ocr_configuration', 'ingestion runs preserve OCR configuration');
select has_column('app_private', 'policy_ingestion_runs', 'chunking_config_sha256', 'ingestion runs hash chunking configuration');
select has_column('app_private', 'policy_ingestion_runs', 'resumes_run_id', 'ingestion runs can point to a resumed run');
select has_column('app_private', 'policy_ingestion_runs', 'failure_code', 'ingestion runs store a safe failure code');
select has_column('app_private', 'policy_pages', 'heading', 'policy pages preserve headings');
select has_column('app_private', 'policy_pages', 'section_path', 'policy pages preserve section hierarchy');
select has_column('app_private', 'policy_pages', 'warning_codes', 'policy pages preserve controlled warning codes');
select has_column('app_private', 'policy_pages', 'layout_metadata_sha256', 'policy pages can identify retained layout metadata');

select ok(
  'validating' = any(enum_range(null::app_private.policy_ingestion_status)::text[])
  and 'chunking' = any(enum_range(null::app_private.policy_ingestion_status)::text[]),
  'ingestion lifecycle includes validating and chunking stages'
);

select lives_ok(
  $$
    insert into app_private.policy_documents (
      id, facility_id, stable_key, title, collection, status
    )
    select
      '71717171-7171-4171-8171-717171717171',
      facility.id,
      'fictional-local-ingestion',
      'Fictional Local Ingestion Policy',
      'BMU policies',
      'approved'
    from app_private.facilities as facility
    limit 1;

    insert into app_private.policy_document_versions (
      id, document_id, version_label, source_sha256, storage_path,
      media_type, page_count, source_filename
    ) values (
      '72727272-7272-4272-8272-727272727272',
      '71717171-7171-4171-8171-717171717171',
      'fictional-docx-v1',
      repeat('7', 64),
      'fictional-local-ingestion/' || repeat('7', 64) || '.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      1,
      'fictional-local-ingestion.docx'
    );

    insert into app_private.policy_ingestion_runs (
      id, document_version_id, environment, source_sha256, collection,
      source_filename, extraction_provider, extraction_tool, extraction_version,
      extraction_config_sha256, normalization_version, chunking_version,
      chunking_config_sha256, chunking_configuration, code_commit_sha,
      dependency_lock_sha256
    ) values
      (
        '73737373-7373-4373-8373-737373737373',
        '72727272-7272-4272-8272-727272727272', 'ci', repeat('7', 64),
        'BMU policies', 'fictional-local-ingestion.docx', 'mineru', 'mineru',
        '3.4.5', repeat('8', 64), 'fictional-normalization-v1',
        'section-page-v1', repeat('9', 64), jsonb_build_object('max_pages', 2),
        repeat('a', 40), repeat('b', 64)
      ),
      (
        '74747474-7474-4474-8474-747474747474',
        '72727272-7272-4272-8272-727272727272', 'ci', repeat('7', 64),
        'BMU policies', 'fictional-local-ingestion.docx', 'mineru', 'mineru',
        '3.4.5', repeat('c', 64), 'fictional-normalization-v1',
        'section-page-v1', repeat('d', 64), jsonb_build_object('max_pages', 1),
        repeat('a', 40), repeat('b', 64)
      );

    insert into app_private.policy_pages (
      document_version_id, ingestion_run_id, source_page_index,
      normalized_text, normalized_text_sha256, extraction_mode,
      heading, section_path, warning_codes
    ) values
      (
        '72727272-7272-4272-8272-727272727272',
        '73737373-7373-4373-8373-737373737373', 1,
        'Fictional first extraction.', repeat('e', 64), 'native',
        'Fictional heading', 'Fictional heading', array[]::text[]
      ),
      (
        '72727272-7272-4272-8272-727272727272',
        '74747474-7474-4474-8474-747474747474', 1,
        'Fictional retry extraction.', repeat('f', 64), 'native',
        'Fictional heading', 'Fictional heading', array['fictional_warning']
      );

    insert into app_private.policy_chunks (
      id, document_version_id, ingestion_run_id, ordinal, page_start, page_end,
      section_path, content, content_sha256
    ) values
      (
        '75757575-7575-4575-8575-757575757575',
        '72727272-7272-4272-8272-727272727272',
        '73737373-7373-4373-8373-737373737373', 0, 1, 1,
        'Fictional heading', 'Fictional first chunk.', repeat('1', 64)
      ),
      (
        '76767676-7676-4676-8676-767676767676',
        '72727272-7272-4272-8272-727272727272',
        '74747474-7474-4474-8474-747474747474', 0, 1, 1,
        'Fictional heading', 'Fictional retry chunk.', repeat('2', 64)
      );
  $$,
  'DOCX provenance and the same ordinal from separate runs can be stored safely'
);

select ok(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'app_private.policy_document_versions'::regclass
      and conname = 'policy_document_versions_media_type_check'
  ) like '%image/tiff%'
  and (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'app_private.policy_document_versions'::regclass
      and conname = 'policy_document_versions_media_type_check'
  ) like '%wordprocessingml.document%',
  'registered policy versions allow DOCX and common scanned-image media types'
);

select throws_ok(
  $$
    insert into app_private.policy_ingestion_runs (
      document_version_id, environment, source_sha256, collection,
      extraction_provider, extraction_tool, extraction_version,
      extraction_config_sha256, normalization_version, chunking_version,
      chunking_config_sha256, chunking_configuration, code_commit_sha,
      dependency_lock_sha256
    ) values (
      '72727272-7272-4272-8272-727272727272', 'ci', repeat('7', 64), 'SD',
      'mineru', 'mineru', '3.4.5', repeat('3', 64),
      'fictional-normalization-v1', 'section-page-v1', repeat('4', 64),
      jsonb_build_object('max_pages', 2), repeat('a', 40), repeat('b', 64)
    )
  $$,
  'Ingestion collection does not match the registered policy collection',
  'collection cannot be changed or inferred differently during ingestion'
);

select throws_ok(
  $$
    insert into app_private.policy_ingestion_runs (
      document_version_id, environment, source_sha256, collection,
      extraction_provider, extraction_tool, extraction_version,
      extraction_config_sha256, normalization_version, chunking_version,
      chunking_config_sha256, chunking_configuration, code_commit_sha,
      dependency_lock_sha256
    ) values (
      '72727272-7272-4272-8272-727272727272', 'ci', repeat('7', 64), 'BMU policies',
      'mineru', 'mineru', '3.4.5', repeat('8', 64),
      'fictional-normalization-v1', 'section-page-v1', repeat('9', 64),
      jsonb_build_object('max_pages', 2), repeat('a', 40), repeat('b', 64)
    )
  $$,
  '23505',
  null,
  'an active source and configuration identity is idempotent'
);

select ok(
  not has_table_privilege('anon', 'app_private.policy_pages', 'insert')
  and not has_table_privilege('authenticated', 'app_private.policy_pages', 'insert')
  and not has_table_privilege('service_role', 'app_private.policy_pages', 'insert'),
  'browser and runtime roles cannot write private ingestion pages directly'
);

select * from finish();

rollback;
