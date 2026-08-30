begin;

create type app_private.policy_rights_status as enum (
  'pending',
  'approved_internal_search',
  'approved_full_reader',
  'restricted_provider',
  'quarantined',
  'rejected',
  'expired_review'
);

create type app_private.policy_lifecycle_status as enum (
  'pending',
  'active',
  'superseded',
  'quarantined',
  'missing',
  'rejected',
  'retired'
);

create type app_private.policy_ingestion_status as enum (
  'queued',
  'extracting',
  'awaiting_review',
  'embedding',
  'ready',
  'failed',
  'quarantined',
  'superseded'
);

create type app_private.policy_qa_status as enum (
  'pending',
  'approved',
  'rejected'
);

create type app_private.policy_page_extraction_mode as enum (
  'native',
  'ocr',
  'mixed',
  'empty_expected'
);

alter table app_private.policy_document_versions
  add column source_filename text,
  add column byte_size bigint check (byte_size is null or byte_size > 0),
  add column supersedes_version_id uuid
    references app_private.policy_document_versions(id) on delete restrict,
  add column rights_status app_private.policy_rights_status not null default 'pending',
  add column rights_evidence_ref text,
  add column rights_reviewed_by uuid
    references app_private.staff_members(id) on delete restrict,
  add column rights_reviewed_at timestamptz,
  add column rights_review_due_at timestamptz,
  add column allowed_processing_regions text[] not null default '{}',
  add column external_ai_allowed boolean not null default false,
  add column lifecycle_status app_private.policy_lifecycle_status not null default 'pending',
  add column is_current boolean not null default false,
  add constraint policy_document_versions_rights_review_fields_check check (
    (rights_reviewed_by is null) = (rights_reviewed_at is null)
  ),
  add constraint policy_document_versions_rights_review_window_check check (
    rights_review_due_at is null
    or rights_reviewed_at is null
    or rights_review_due_at > rights_reviewed_at
  ),
  add constraint policy_document_versions_approved_rights_evidence_check check (
    rights_status not in ('approved_internal_search', 'approved_full_reader')
    or (
      coalesce(char_length(btrim(rights_evidence_ref)), 0) > 0
      and rights_reviewed_by is not null
      and rights_reviewed_at is not null
    )
  ),
  add constraint policy_document_versions_external_ai_rights_check check (
    not external_ai_allowed
    or rights_status in ('approved_internal_search', 'approved_full_reader')
  );

create index policy_document_versions_supersedes_idx
  on app_private.policy_document_versions (supersedes_version_id)
  where supersedes_version_id is not null;
create index policy_document_versions_rights_reviewer_idx
  on app_private.policy_document_versions (rights_reviewed_by)
  where rights_reviewed_by is not null;
create index policy_document_versions_retrieval_idx
  on app_private.policy_document_versions (
    document_id,
    lifecycle_status,
    rights_status,
    indexed_at
  )
  where is_current;
create unique index policy_document_versions_one_current_idx
  on app_private.policy_document_versions (document_id)
  where is_current;

create table app_private.policy_ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  document_version_id uuid not null
    references app_private.policy_document_versions(id) on delete restrict,
  environment text not null
    check (environment in ('local', 'ci', 'preview', 'production')),
  source_sha256 text not null check (source_sha256 ~ '^[a-f0-9]{64}$'),
  extraction_tool text not null check (char_length(extraction_tool) between 1 and 120),
  extraction_version text not null check (char_length(extraction_version) between 1 and 120),
  extraction_config_sha256 text not null
    check (extraction_config_sha256 ~ '^[a-f0-9]{64}$'),
  ocr_engine text,
  ocr_version text,
  ocr_language text,
  ocr_config_sha256 text
    check (ocr_config_sha256 is null or ocr_config_sha256 ~ '^[a-f0-9]{64}$'),
  normalization_version text not null
    check (char_length(normalization_version) between 1 and 120),
  chunking_version text not null
    check (char_length(chunking_version) between 1 and 120),
  embedding_profile_key text
    references app_private.embedding_profiles(profile_key) on delete restrict,
  code_commit_sha text not null check (code_commit_sha ~ '^[a-f0-9]{40}$'),
  dependency_lock_sha256 text not null
    check (dependency_lock_sha256 ~ '^[a-f0-9]{64}$'),
  status app_private.policy_ingestion_status not null default 'queued',
  qa_status app_private.policy_qa_status not null default 'pending',
  qa_reviewed_by uuid references app_private.staff_members(id) on delete restrict,
  qa_reviewed_at timestamptz,
  started_at timestamptz not null default statement_timestamp(),
  completed_at timestamptz,
  page_count integer not null default 0 check (page_count >= 0),
  chunk_count integer not null default 0 check (chunk_count >= 0),
  warning_count integer not null default 0 check (warning_count >= 0),
  failure_count integer not null default 0 check (failure_count >= 0),
  created_at timestamptz not null default statement_timestamp(),
  unique (id, document_version_id),
  check ((qa_reviewed_by is null) = (qa_reviewed_at is null)),
  check (qa_status = 'pending' or qa_reviewed_by is not null),
  check (completed_at is null or completed_at >= started_at),
  check (
    status <> 'ready'
    or (
      qa_status = 'approved'
      and completed_at is not null
      and page_count > 0
      and chunk_count > 0
      and failure_count = 0
    )
  )
);

create index policy_ingestion_runs_version_status_idx
  on app_private.policy_ingestion_runs (document_version_id, status, created_at desc);
create index policy_ingestion_runs_embedding_profile_idx
  on app_private.policy_ingestion_runs (embedding_profile_key)
  where embedding_profile_key is not null;
create index policy_ingestion_runs_qa_reviewer_idx
  on app_private.policy_ingestion_runs (qa_reviewed_by)
  where qa_reviewed_by is not null;

create or replace function app_private.validate_policy_ingestion_source()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  expected_sha256 text;
begin
  select version.source_sha256
    into strict expected_sha256
    from app_private.policy_document_versions as version
    where version.id = new.document_version_id;

  if new.source_sha256 <> expected_sha256 then
    raise exception 'Ingestion source hash does not match the immutable policy version';
  end if;

  return new;
end;
$$;

create trigger policy_ingestion_runs_validate_source
before insert or update of document_version_id, source_sha256
on app_private.policy_ingestion_runs
for each row execute function app_private.validate_policy_ingestion_source();

revoke all on function app_private.validate_policy_ingestion_source()
  from public, anon, authenticated, service_role;

create or replace function app_private.protect_policy_ingestion_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.document_version_id is distinct from old.document_version_id
    or new.environment is distinct from old.environment
    or new.source_sha256 is distinct from old.source_sha256
    or new.extraction_tool is distinct from old.extraction_tool
    or new.extraction_version is distinct from old.extraction_version
    or new.extraction_config_sha256 is distinct from old.extraction_config_sha256
    or new.ocr_engine is distinct from old.ocr_engine
    or new.ocr_version is distinct from old.ocr_version
    or new.ocr_language is distinct from old.ocr_language
    or new.ocr_config_sha256 is distinct from old.ocr_config_sha256
    or new.normalization_version is distinct from old.normalization_version
    or new.chunking_version is distinct from old.chunking_version
    or new.embedding_profile_key is distinct from old.embedding_profile_key
    or new.code_commit_sha is distinct from old.code_commit_sha
    or new.dependency_lock_sha256 is distinct from old.dependency_lock_sha256 then
    raise exception 'Policy ingestion identity is immutable; create a new run instead';
  end if;

  return new;
end;
$$;

create trigger policy_ingestion_runs_protect_identity
before update on app_private.policy_ingestion_runs
for each row execute function app_private.protect_policy_ingestion_identity();

revoke all on function app_private.protect_policy_ingestion_identity()
  from public, anon, authenticated, service_role;

create table app_private.policy_pages (
  id bigint generated always as identity primary key,
  document_version_id uuid not null,
  ingestion_run_id uuid not null,
  source_page_index integer not null check (source_page_index > 0),
  printed_page_label text,
  normalized_text text not null,
  normalized_text_sha256 text not null
    check (normalized_text_sha256 ~ '^[a-f0-9]{64}$'),
  extraction_mode app_private.policy_page_extraction_mode not null,
  ocr_confidence numeric(5, 4)
    check (ocr_confidence is null or ocr_confidence between 0 and 1),
  quality_flags text[] not null default '{}',
  page_width_points numeric(10, 3)
    check (page_width_points is null or page_width_points > 0),
  page_height_points numeric(10, 3)
    check (page_height_points is null or page_height_points > 0),
  rotation_degrees smallint
    check (rotation_degrees is null or rotation_degrees in (0, 90, 180, 270)),
  structured_layout_ref text check (
    structured_layout_ref is null
    or (
      structured_layout_ref !~ '(^|/)\.\.(/|$)'
      and structured_layout_ref !~ '^/'
      and char_length(structured_layout_ref) between 1 and 1024
    )
  ),
  rendered_page_sha256 text
    check (rendered_page_sha256 is null or rendered_page_sha256 ~ '^[a-f0-9]{64}$'),
  extraction_warning text,
  review_status app_private.policy_qa_status not null default 'pending',
  created_at timestamptz not null default statement_timestamp(),
  unique (ingestion_run_id, source_page_index),
  foreign key (ingestion_run_id, document_version_id)
    references app_private.policy_ingestion_runs(id, document_version_id)
    on delete restrict,
  check (
    extraction_mode = 'empty_expected'
    or char_length(normalized_text) > 0
    or extraction_warning is not null
  )
);

create index policy_pages_version_page_idx
  on app_private.policy_pages (document_version_id, source_page_index);

alter table app_private.policy_chunks
  add column ingestion_run_id uuid,
  add column printed_page_start text,
  add column printed_page_end text,
  add column start_character integer check (start_character is null or start_character >= 0),
  add column end_character integer check (end_character is null or end_character > 0),
  add column overlap_token_count integer not null default 0
    check (overlap_token_count >= 0),
  add column token_count integer check (token_count is null or token_count > 0),
  add column lifecycle_status app_private.policy_lifecycle_status not null default 'pending',
  add column qa_approved boolean not null default false,
  add constraint policy_chunks_character_range_check check (
    (start_character is null) = (end_character is null)
    and (start_character is null or end_character > start_character)
  ),
  add constraint policy_chunks_page_span_check check (
    page_start is null or page_end - page_start <= 10
  ) not valid,
  add constraint policy_chunks_ingestion_run_version_fkey
    foreign key (ingestion_run_id, document_version_id)
    references app_private.policy_ingestion_runs(id, document_version_id)
    on delete restrict not valid,
  add constraint policy_chunks_start_page_fkey
    foreign key (ingestion_run_id, page_start)
    references app_private.policy_pages(ingestion_run_id, source_page_index)
    on delete restrict not valid,
  add constraint policy_chunks_end_page_fkey
    foreign key (ingestion_run_id, page_end)
    references app_private.policy_pages(ingestion_run_id, source_page_index)
    on delete restrict not valid;

create index policy_chunks_ingestion_run_idx
  on app_private.policy_chunks (ingestion_run_id, ordinal)
  where ingestion_run_id is not null;
create index policy_chunks_retrieval_ready_idx
  on app_private.policy_chunks (document_version_id, ingestion_run_id, ordinal)
  where lifecycle_status = 'active' and qa_approved;

create or replace function app_private.require_policy_chunk_provenance()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  mapped_page_count integer;
begin
  if new.ingestion_run_id is null or new.page_start is null or new.page_end is null then
    raise exception 'New policy chunks require an ingestion run and bounded source pages';
  end if;

  if new.page_end - new.page_start > 10 then
    raise exception 'Policy chunks cannot span more than ten source pages';
  end if;

  select count(*)::integer
    into mapped_page_count
    from app_private.policy_pages as page
    where page.ingestion_run_id = new.ingestion_run_id
      and page.source_page_index between new.page_start and new.page_end;

  if mapped_page_count <> new.page_end - new.page_start + 1 then
    raise exception 'Policy chunk source-page range is incomplete';
  end if;

  return new;
end;
$$;

create trigger policy_chunks_require_provenance
before insert or update of ingestion_run_id, page_start, page_end
on app_private.policy_chunks
for each row execute function app_private.require_policy_chunk_provenance();

revoke all on function app_private.require_policy_chunk_provenance()
  from public, anon, authenticated, service_role;

create or replace function app_private.validate_ready_policy_ingestion()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  stored_page_count integer;
  stored_chunk_count integer;
begin
  if new.status <> 'ready' then
    return new;
  end if;

  select count(*)::integer
    into stored_page_count
    from app_private.policy_pages as page
    where page.ingestion_run_id = new.id
      and page.review_status = 'approved';

  select count(*)::integer
    into stored_chunk_count
    from app_private.policy_chunks as chunk
    where chunk.ingestion_run_id = new.id
      and chunk.lifecycle_status = 'active'
      and chunk.qa_approved;

  if new.qa_status <> 'approved'
    or new.qa_reviewed_by is null
    or new.qa_reviewed_at is null
    or new.completed_at is null
    or new.failure_count <> 0
    or new.page_count <> stored_page_count
    or new.chunk_count <> stored_chunk_count
    or stored_page_count = 0
    or stored_chunk_count = 0 then
    raise exception 'Ready policy ingestion counts and QA evidence must match stored pages and chunks';
  end if;

  return new;
end;
$$;

create trigger policy_ingestion_runs_validate_ready
before insert or update of
  status,
  qa_status,
  qa_reviewed_by,
  qa_reviewed_at,
  completed_at,
  page_count,
  chunk_count,
  failure_count
on app_private.policy_ingestion_runs
for each row execute function app_private.validate_ready_policy_ingestion();

revoke all on function app_private.validate_ready_policy_ingestion()
  from public, anon, authenticated, service_role;

create or replace function app_private.protect_ready_policy_evidence()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1
    from app_private.policy_ingestion_runs as ingestion
    where ingestion.id = old.ingestion_run_id
      and ingestion.status = 'ready'
  ) then
    raise exception 'Move the policy ingestion run out of ready before changing its page or chunk evidence';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger policy_pages_protect_ready_evidence
before update or delete on app_private.policy_pages
for each row execute function app_private.protect_ready_policy_evidence();

create trigger policy_chunks_protect_ready_evidence
before update or delete on app_private.policy_chunks
for each row execute function app_private.protect_ready_policy_evidence();

revoke all on function app_private.protect_ready_policy_evidence()
  from public, anon, authenticated, service_role;

alter table app_private.policy_ingestion_runs enable row level security;
alter table app_private.policy_ingestion_runs force row level security;
alter table app_private.policy_pages enable row level security;
alter table app_private.policy_pages force row level security;

revoke all on table app_private.policy_ingestion_runs
  from public, anon, authenticated, service_role;
revoke all on table app_private.policy_pages
  from public, anon, authenticated, service_role;
revoke all on sequence app_private.policy_pages_id_seq
  from public, anon, authenticated, service_role;

create or replace function api.retrieve_policy_passages(
  p_question text,
  p_limit integer default 8
)
returns table (
  document_id uuid,
  document_version_id uuid,
  chunk_id uuid,
  stable_key text,
  title text,
  version_label text,
  source_sha256 text,
  page_start integer,
  page_end integer,
  section_path text,
  excerpt text,
  relevance_score real
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_facility_id uuid;
  query_terms tsquery;
begin
  if p_limit not between 1 and 12 then
    raise exception using errcode = '22023', message = 'Invalid policy retrieval limit';
  end if;

  if char_length(btrim(coalesce(p_question, ''))) not between 3 and 2000 then
    raise exception using errcode = '22023', message = 'Invalid policy retrieval question';
  end if;

  select staff.facility_id
    into actor_facility_id
    from app_private.user_accounts as account
    join app_private.staff_members as staff on staff.id = account.staff_member_id
    where account.auth_user_id = auth.uid()
      and account.status = 'active'
      and staff.status = 'active';

  if not found then
    return;
  end if;

  query_terms := plainto_tsquery('english', p_question);
  if numnode(query_terms) = 0 then
    return;
  end if;

  return query
    select
      document.id,
      version.id,
      chunk.id,
      document.stable_key,
      document.title,
      version.version_label,
      version.source_sha256,
      chunk.page_start,
      chunk.page_end,
      chunk.section_path,
      left(chunk.content, 1200),
      ts_rank_cd(chunk.content_tsv, query_terms)::real
    from app_private.policy_chunks as chunk
    join app_private.policy_ingestion_runs as ingestion
      on ingestion.id = chunk.ingestion_run_id
      and ingestion.document_version_id = chunk.document_version_id
    join app_private.policy_document_versions as version
      on version.id = chunk.document_version_id
    join app_private.policy_documents as document
      on document.id = version.document_id
    join app_private.policy_pages as start_page
      on start_page.ingestion_run_id = chunk.ingestion_run_id
      and start_page.source_page_index = chunk.page_start
    join app_private.policy_pages as end_page
      on end_page.ingestion_run_id = chunk.ingestion_run_id
      and end_page.source_page_index = chunk.page_end
    where document.facility_id = actor_facility_id
      and document.status = 'approved'
      and version.approved_at is not null
      and version.indexed_at is not null
      and version.lifecycle_status = 'active'
      and version.is_current
      and version.rights_status in ('approved_internal_search', 'approved_full_reader')
      and version.external_ai_allowed
      and (version.rights_review_due_at is null or version.rights_review_due_at > statement_timestamp())
      and ingestion.status = 'ready'
      and ingestion.qa_status = 'approved'
      and ingestion.source_sha256 = version.source_sha256
      and start_page.review_status = 'approved'
      and end_page.review_status = 'approved'
      and chunk.lifecycle_status = 'active'
      and chunk.qa_approved
      and chunk.content_tsv @@ query_terms
    order by ts_rank_cd(chunk.content_tsv, query_terms) desc, chunk.id
    limit p_limit;
end;
$$;

comment on function api.retrieve_policy_passages(text, integer) is
  'Returns bounded passages only from current, rights-approved, page-verified, ready policy ingestion runs.';

revoke all on function api.retrieve_policy_passages(text, integer)
  from public, anon, service_role;
grant usage on schema api to authenticated;
grant execute on function api.retrieve_policy_passages(text, integer) to authenticated;

commit;
