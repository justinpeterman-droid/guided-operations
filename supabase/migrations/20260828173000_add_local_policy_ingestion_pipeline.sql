begin;

create type app_private.policy_collection as enum (
  'BMU policies',
  'BMU Post Orders',
  'SD'
);

alter type app_private.policy_ingestion_status
  add value if not exists 'validating' before 'awaiting_review';
alter type app_private.policy_ingestion_status
  add value if not exists 'chunking' before 'embedding';

alter table app_private.policy_documents
  add column collection app_private.policy_collection;

create index policy_documents_facility_collection_status_idx
  on app_private.policy_documents (facility_id, collection, status, title)
  where collection is not null;

alter table app_private.policy_document_versions
  drop constraint policy_document_versions_media_type_check,
  add constraint policy_document_versions_media_type_check check (
    media_type in (
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/bmp',
      'image/jpeg',
      'image/png',
      'image/tiff',
      'image/webp',
      'text/plain'
    )
  );

alter table app_private.policy_ingestion_runs
  add column collection app_private.policy_collection,
  add column source_filename text check (
    source_filename is null
    or (
      char_length(source_filename) between 1 and 300
      and source_filename !~ '[/\\]'
    )
  ),
  add column extraction_provider text check (
    extraction_provider is null
    or extraction_provider ~ '^[a-z][a-z0-9._-]{1,63}$'
  ),
  add column extraction_model_version text check (
    extraction_model_version is null
    or char_length(extraction_model_version) between 1 and 160
  ),
  add column ocr_configuration jsonb check (
    ocr_configuration is null or jsonb_typeof(ocr_configuration) = 'object'
  ),
  add column chunking_config_sha256 text check (
    chunking_config_sha256 is null
    or chunking_config_sha256 ~ '^[a-f0-9]{64}$'
  ),
  add column chunking_configuration jsonb check (
    chunking_configuration is null
    or jsonb_typeof(chunking_configuration) = 'object'
  ),
  add column attempt_number integer not null default 1
    check (attempt_number between 1 and 1000),
  add column resumes_run_id uuid
    references app_private.policy_ingestion_runs(id) on delete restrict,
  add column last_completed_stage text check (
    last_completed_stage is null
    or last_completed_stage in (
      'queued',
      'extracting',
      'validating',
      'chunking',
      'awaiting_review',
      'ready'
    )
  ),
  add column last_checkpoint_at timestamptz,
  add column failure_code text check (
    failure_code is null or failure_code ~ '^[a-z][a-z0-9_.-]{2,63}$'
  ),
  add column failure_message text check (
    failure_message is null
    or char_length(failure_message) between 1 and 500
  ),
  add constraint policy_ingestion_runs_resume_not_self_check check (
    resumes_run_id is null or resumes_run_id <> id
  ),
  add constraint policy_ingestion_runs_failure_detail_check check (
    (failure_code is null) = (failure_message is null)
  );

create index policy_ingestion_runs_collection_status_idx
  on app_private.policy_ingestion_runs (collection, status, created_at desc)
  where collection is not null;
create index policy_ingestion_runs_resumes_run_idx
  on app_private.policy_ingestion_runs (resumes_run_id)
  where resumes_run_id is not null;
create unique index policy_ingestion_runs_active_identity_idx
  on app_private.policy_ingestion_runs (
    document_version_id,
    source_sha256,
    extraction_config_sha256,
    normalization_version,
    chunking_version,
    chunking_config_sha256
  )
  where status not in ('failed', 'quarantined', 'superseded')
    and chunking_config_sha256 is not null;

create or replace function app_private.validate_policy_ingestion_source()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  expected_sha256 text;
  expected_collection app_private.policy_collection;
begin
  select version.source_sha256, document.collection
    into strict expected_sha256, expected_collection
    from app_private.policy_document_versions as version
    join app_private.policy_documents as document
      on document.id = version.document_id
    where version.id = new.document_version_id;

  if new.source_sha256 <> expected_sha256 then
    raise exception 'Ingestion source hash does not match the immutable policy version';
  end if;

  if new.collection is null
    or expected_collection is null
    or new.collection <> expected_collection then
    raise exception 'Ingestion collection does not match the registered policy collection';
  end if;

  if new.extraction_provider is null
    or new.chunking_config_sha256 is null
    or new.chunking_configuration is null then
    raise exception 'New policy ingestion requires provider and chunking configuration provenance';
  end if;

  return new;
end;
$$;

drop trigger policy_ingestion_runs_validate_source
  on app_private.policy_ingestion_runs;
create trigger policy_ingestion_runs_validate_source
before insert or update of
  document_version_id,
  source_sha256,
  collection,
  extraction_provider,
  chunking_config_sha256,
  chunking_configuration
on app_private.policy_ingestion_runs
for each row execute function app_private.validate_policy_ingestion_source();

create or replace function app_private.protect_policy_ingestion_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.document_version_id is distinct from old.document_version_id
    or new.environment is distinct from old.environment
    or new.source_sha256 is distinct from old.source_sha256
    or new.collection is distinct from old.collection
    or new.source_filename is distinct from old.source_filename
    or new.extraction_provider is distinct from old.extraction_provider
    or new.extraction_tool is distinct from old.extraction_tool
    or new.extraction_version is distinct from old.extraction_version
    or new.extraction_model_version is distinct from old.extraction_model_version
    or new.extraction_config_sha256 is distinct from old.extraction_config_sha256
    or new.ocr_engine is distinct from old.ocr_engine
    or new.ocr_version is distinct from old.ocr_version
    or new.ocr_language is distinct from old.ocr_language
    or new.ocr_config_sha256 is distinct from old.ocr_config_sha256
    or new.ocr_configuration is distinct from old.ocr_configuration
    or new.normalization_version is distinct from old.normalization_version
    or new.chunking_version is distinct from old.chunking_version
    or new.chunking_config_sha256 is distinct from old.chunking_config_sha256
    or new.chunking_configuration is distinct from old.chunking_configuration
    or new.embedding_profile_key is distinct from old.embedding_profile_key
    or new.code_commit_sha is distinct from old.code_commit_sha
    or new.dependency_lock_sha256 is distinct from old.dependency_lock_sha256
    or new.attempt_number is distinct from old.attempt_number
    or new.resumes_run_id is distinct from old.resumes_run_id then
    raise exception 'Policy ingestion identity is immutable; create a new run instead';
  end if;

  return new;
end;
$$;

alter table app_private.policy_pages
  add column heading text check (
    heading is null or char_length(heading) between 1 and 500
  ),
  add column section_path text check (
    section_path is null or char_length(section_path) between 1 and 1000
  ),
  add column warning_codes text[] not null default '{}',
  add column layout_metadata_sha256 text check (
    layout_metadata_sha256 is null
    or layout_metadata_sha256 ~ '^[a-f0-9]{64}$'
  );

alter table app_private.policy_chunks
  drop constraint policy_chunks_document_version_id_ordinal_key;

create unique index policy_chunks_run_ordinal_unique_idx
  on app_private.policy_chunks (ingestion_run_id, ordinal)
  where ingestion_run_id is not null;
create unique index policy_chunks_legacy_version_ordinal_unique_idx
  on app_private.policy_chunks (document_version_id, ordinal)
  where ingestion_run_id is null;

comment on type app_private.policy_collection is
  'Canonical owner-approved source collection. Values are retained verbatim through ingestion and retrieval provenance.';
comment on column app_private.policy_documents.collection is
  'Explicit source collection; it is never inferred from a filename after registration.';
comment on column app_private.policy_ingestion_runs.chunking_config_sha256 is
  'SHA-256 of the canonical deterministic chunking configuration used by this immutable run.';
comment on column app_private.policy_ingestion_runs.failure_message is
  'Bounded, redacted operator detail only. Source text, paths, credentials, and provider bodies are prohibited.';

commit;
