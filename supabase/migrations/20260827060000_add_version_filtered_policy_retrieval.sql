begin;

create or replace function api.retrieve_policy_passages_v2(
  p_question text,
  p_limit integer default 8,
  p_approved_document_version_ids uuid[] default null
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

  if p_approved_document_version_ids is not null
    and (
      cardinality(p_approved_document_version_ids) not between 1 and 50
      or array_position(p_approved_document_version_ids, null) is not null
    ) then
    raise exception using errcode = '22023', message = 'Invalid approved policy version filter';
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
      and (
        p_approved_document_version_ids is null
        or version.id = any(p_approved_document_version_ids)
      )
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

comment on function api.retrieve_policy_passages_v2(text, integer, uuid[]) is
  'Returns bounded passages only from current, rights-approved, page-verified, ready policy ingestion runs, optionally restricted to an explicit approved version set.';

revoke all on function api.retrieve_policy_passages_v2(text, integer, uuid[])
  from public, anon, service_role;
grant usage on schema api to authenticated;
grant execute on function api.retrieve_policy_passages_v2(text, integer, uuid[])
  to authenticated;

commit;
