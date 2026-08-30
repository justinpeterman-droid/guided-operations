begin;

create function api.retrieve_policy_passages_v4(
  p_question text,
  p_query_embedding extensions.vector,
  p_embedding_profile_key text,
  p_limit integer default 8,
  p_approved_document_version_ids uuid[] default null,
  p_collections text[] default null
)
returns table (
  document_id uuid,
  document_version_id uuid,
  chunk_id uuid,
  stable_key text,
  title text,
  version_label text,
  source_sha256 text,
  collection text,
  page_start integer,
  page_end integer,
  section_path text,
  excerpt text,
  relevance_score real,
  lexical_rank integer,
  semantic_rank integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_facility_id uuid;
  expected_dimensions integer;
  query_terms tsquery;
  candidate_limit integer;
begin
  if p_limit not between 1 and 12 then
    raise exception using errcode = '22023', message = 'Invalid policy retrieval limit';
  end if;

  if char_length(btrim(coalesce(p_question, ''))) not between 3 and 2000 then
    raise exception using errcode = '22023', message = 'Invalid policy retrieval question';
  end if;

  if p_approved_document_version_ids is not null
    and (
      cardinality(p_approved_document_version_ids) not between 1 and 50
      or array_position(p_approved_document_version_ids, null) is not null
    ) then
    raise exception using errcode = '22023', message = 'Invalid approved policy version filter';
  end if;

  if p_collections is not null
    and (
      cardinality(p_collections) not between 1 and 3
      or array_position(p_collections, null) is not null
      or exists (
        select 1
        from unnest(p_collections) as requested_collection(value)
        where requested_collection.value not in (
          'BMU policies',
          'BMU Post Orders',
          'SD'
        )
      )
    ) then
    raise exception using errcode = '22023', message = 'Invalid policy collection filter';
  end if;

  if coalesce(char_length(p_embedding_profile_key), 0) not between 2 and 128
    or p_embedding_profile_key !~ '^[a-z0-9][a-z0-9._-]{1,127}$' then
    raise exception using errcode = '22023', message = 'Invalid policy embedding profile';
  end if;

  select profile.dimensions
    into expected_dimensions
    from app_private.embedding_profiles as profile
    where profile.profile_key = p_embedding_profile_key
      and profile.enabled;

  if expected_dimensions is null
    or p_query_embedding is null
    or extensions.vector_dims(p_query_embedding) <> expected_dimensions
    or extensions.vector_norm(p_query_embedding) <= 0 then
    raise exception using errcode = '22023', message = 'Invalid policy query embedding';
  end if;

  actor_facility_id := app_private.current_policy_facility_id();
  if actor_facility_id is null then
    return;
  end if;

  query_terms := plainto_tsquery('english', p_question);
  candidate_limit := least(60, greatest(20, p_limit * 5));

  return query
    with eligible as materialized (
      select
        document.id as document_id,
        version.id as document_version_id,
        chunk.id as chunk_id,
        document.stable_key,
        document.title,
        version.version_label,
        version.source_sha256,
        document.collection::text as collection,
        chunk.page_start,
        chunk.page_end,
        chunk.section_path,
        chunk.content,
        chunk.content_tsv,
        chunk_embedding.embedding
      from app_private.policy_chunks as chunk
      join app_private.policy_chunk_embeddings as chunk_embedding
        on chunk_embedding.policy_chunk_id = chunk.id
        and chunk_embedding.profile_key = p_embedding_profile_key
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
        and document.collection is not null
        and document.status = 'approved'
        and version.approved_at is not null
        and version.indexed_at is not null
        and version.lifecycle_status = 'active'
        and version.is_current
        and version.rights_status in ('approved_internal_search', 'approved_full_reader')
        and version.external_ai_allowed
        and (version.rights_review_due_at is null or version.rights_review_due_at > statement_timestamp())
        and (
          p_approved_document_version_ids is null
          or version.id = any(p_approved_document_version_ids)
        )
        and (
          p_collections is null
          or document.collection::text = any(p_collections)
        )
        and ingestion.status = 'ready'
        and ingestion.qa_status = 'approved'
        and ingestion.source_sha256 = version.source_sha256
        and ingestion.collection = document.collection
        and start_page.review_status = 'approved'
        and end_page.review_status = 'approved'
        and chunk.lifecycle_status = 'active'
        and chunk.qa_approved
    ),
    lexical_candidates as (
      select
        candidate.chunk_id,
        row_number() over (
          order by
            ts_rank_cd(candidate.content_tsv, query_terms) desc,
            candidate.chunk_id
        )::integer as rank
      from eligible as candidate
      where numnode(query_terms) > 0
        and candidate.content_tsv @@ query_terms
      order by
        ts_rank_cd(candidate.content_tsv, query_terms) desc,
        candidate.chunk_id
      limit candidate_limit
    ),
    semantic_candidates as (
      select
        candidate.chunk_id,
        row_number() over (
          order by
            candidate.embedding operator(extensions.<=>) p_query_embedding,
            candidate.chunk_id
        )::integer as rank
      from eligible as candidate
      order by
        candidate.embedding operator(extensions.<=>) p_query_embedding,
        candidate.chunk_id
      limit candidate_limit
    ),
    fused as (
      select
        coalesce(lexical.chunk_id, semantic.chunk_id) as chunk_id,
        lexical.rank as lexical_rank,
        semantic.rank as semantic_rank,
        (
          coalesce(1.0 / (60.0 + lexical.rank), 0.0)
          + coalesce(1.0 / (60.0 + semantic.rank), 0.0)
        )::real as relevance_score
      from lexical_candidates as lexical
      full join semantic_candidates as semantic using (chunk_id)
    )
    select
      candidate.document_id,
      candidate.document_version_id,
      candidate.chunk_id,
      candidate.stable_key,
      candidate.title,
      candidate.version_label,
      candidate.source_sha256,
      candidate.collection,
      candidate.page_start,
      candidate.page_end,
      candidate.section_path,
      left(candidate.content, 1200),
      fused.relevance_score,
      fused.lexical_rank,
      fused.semantic_rank
    from fused
    join eligible as candidate using (chunk_id)
    order by fused.relevance_score desc, candidate.chunk_id
    limit p_limit;
end;
$$;

comment on function api.retrieve_policy_passages_v4(
  text, extensions.vector, text, integer, uuid[], text[]
) is
  'Returns authorized policy passages using deterministic reciprocal-rank fusion over lexical and semantic candidates for one enabled embedding profile.';

revoke all on function api.retrieve_policy_passages_v4(
  text, extensions.vector, text, integer, uuid[], text[]
) from public, anon, service_role;
grant execute on function api.retrieve_policy_passages_v4(
  text, extensions.vector, text, integer, uuid[], text[]
) to authenticated;

commit;
