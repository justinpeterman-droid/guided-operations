begin;

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
    join app_private.policy_document_versions as version
      on version.id = chunk.document_version_id
    join app_private.policy_documents as document
      on document.id = version.document_id
    where document.facility_id = actor_facility_id
      and document.status = 'approved'
      and version.approved_at is not null
      and version.indexed_at is not null
      and chunk.content_tsv @@ query_terms
    order by ts_rank_cd(chunk.content_tsv, query_terms) desc, chunk.id
    limit p_limit;
end;
$$;

comment on function api.retrieve_policy_passages(text, integer) is
  'Returns bounded citations from approved, indexed policy versions in the current active account facility.';

revoke all on function api.retrieve_policy_passages(text, integer)
  from public, anon, service_role;
grant usage on schema api to authenticated;
grant execute on function api.retrieve_policy_passages(text, integer) to authenticated;

commit;
