begin;

create or replace function app_private.policy_chunk_pages_are_approved(
  p_ingestion_run_id uuid,
  p_page_start integer,
  p_page_end integer
)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(
    p_ingestion_run_id is not null
    and p_page_start is not null
    and p_page_end is not null
    and p_page_start > 0
    and p_page_end::bigint - p_page_start::bigint between 0 and 10
    and (
      select count(*)
      from app_private.policy_pages as page
      where page.ingestion_run_id = p_ingestion_run_id
        and page.source_page_index between p_page_start and p_page_end
        and page.review_status = 'approved'
    ) = p_page_end::bigint - p_page_start::bigint + 1,
    false
  );
$$;

comment on function app_private.policy_chunk_pages_are_approved(uuid, integer, integer) is
  'Fails closed unless every physical source page in a bounded chunk range exists exactly once and is approved.';

revoke all on function app_private.policy_chunk_pages_are_approved(uuid, integer, integer)
  from public, anon, authenticated, service_role;

create or replace function app_private.validate_ready_policy_ingestion()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  stored_page_count integer;
  stored_page_min integer;
  stored_page_max integer;
  stored_chunk_count integer;
  invalid_chunk_count integer;
begin
  if new.status <> 'ready' then
    return new;
  end if;

  select count(*)::integer, min(page.source_page_index), max(page.source_page_index)
    into stored_page_count, stored_page_min, stored_page_max
    from app_private.policy_pages as page
    where page.ingestion_run_id = new.id
      and page.review_status = 'approved';

  select count(*)::integer
    into stored_chunk_count
    from app_private.policy_chunks as chunk
    where chunk.ingestion_run_id = new.id
      and chunk.lifecycle_status = 'active'
      and chunk.qa_approved;

  select count(*)::integer
    into invalid_chunk_count
    from app_private.policy_chunks as chunk
    where chunk.ingestion_run_id = new.id
      and chunk.lifecycle_status = 'active'
      and chunk.qa_approved
      and not app_private.policy_chunk_pages_are_approved(
        chunk.ingestion_run_id,
        chunk.page_start,
        chunk.page_end
      );

  if new.qa_status <> 'approved'
    or new.qa_reviewed_by is null
    or new.qa_reviewed_at is null
    or new.completed_at is null
    or new.failure_count <> 0
    or new.page_count <> stored_page_count
    or stored_page_min is distinct from 1
    or stored_page_max is distinct from new.page_count
    or new.chunk_count <> stored_chunk_count
    or invalid_chunk_count <> 0
    or stored_page_count = 0
    or stored_chunk_count = 0 then
    raise exception 'Ready policy ingestion counts and QA evidence must match stored pages and chunks';
  end if;

  return new;
end;
$$;

revoke all on function app_private.validate_ready_policy_ingestion()
  from public, anon, authenticated, service_role;

do $$
begin
  if exists (
    select 1
    from app_private.policy_chunks as chunk
    join app_private.policy_ingestion_runs as ingestion
      on ingestion.id = chunk.ingestion_run_id
    where ingestion.status = 'ready'
      and not app_private.policy_chunk_pages_are_approved(
        chunk.ingestion_run_id,
        chunk.page_start,
        chunk.page_end
      )
  ) then
    raise exception 'Ready policy evidence contains an unapproved or incomplete page range';
  end if;
end;
$$;

create or replace function app_private.protect_ready_policy_evidence()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  affected_run_ids uuid[];
  run_record record;
begin
  if tg_op = 'INSERT' then
    affected_run_ids := array[new.ingestion_run_id];
  elsif tg_op = 'DELETE' then
    affected_run_ids := array[old.ingestion_run_id];
  else
    affected_run_ids := array[old.ingestion_run_id, new.ingestion_run_id];
  end if;

  for run_record in
    select ingestion.id, ingestion.status
    from app_private.policy_ingestion_runs as ingestion
    where ingestion.id = any(affected_run_ids)
    order by ingestion.id
    for update
  loop
    if run_record.status = 'ready' then
      raise exception 'Move the policy ingestion run out of ready before changing its page or chunk evidence';
    end if;
  end loop;

  update app_private.policy_ingestion_runs as ingestion
  set qa_status = 'pending',
      qa_reviewed_by = null,
      qa_reviewed_at = null
  where ingestion.id = any(affected_run_ids)
    and (
      ingestion.qa_status <> 'pending'
      or ingestion.qa_reviewed_by is not null
      or ingestion.qa_reviewed_at is not null
    );

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function app_private.reset_policy_page_qa_on_evidence_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (to_jsonb(new) - 'review_status')
    is distinct from (to_jsonb(old) - 'review_status') then
    new.review_status := 'pending';
  end if;
  return new;
end;
$$;

create or replace function app_private.reset_policy_chunk_qa_on_evidence_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (to_jsonb(new) - 'lifecycle_status' - 'qa_approved' - 'content_tsv')
    is distinct from (
      to_jsonb(old) - 'lifecycle_status' - 'qa_approved' - 'content_tsv'
    ) then
    new.lifecycle_status := 'pending';
    new.qa_approved := false;
  end if;
  return new;
end;
$$;

drop trigger policy_pages_protect_ready_evidence
  on app_private.policy_pages;
create trigger policy_pages_protect_ready_evidence
before insert or update or delete on app_private.policy_pages
for each row execute function app_private.protect_ready_policy_evidence();

create trigger policy_pages_reset_qa_on_evidence_change
before update on app_private.policy_pages
for each row execute function app_private.reset_policy_page_qa_on_evidence_change();

drop trigger policy_chunks_protect_ready_evidence
  on app_private.policy_chunks;
create trigger policy_chunks_protect_ready_evidence
before insert or update or delete on app_private.policy_chunks
for each row execute function app_private.protect_ready_policy_evidence();

create trigger policy_chunks_reset_qa_on_evidence_change
before update on app_private.policy_chunks
for each row execute function app_private.reset_policy_chunk_qa_on_evidence_change();

revoke all on function app_private.protect_ready_policy_evidence()
  from public, anon, authenticated, service_role;
revoke all on function app_private.reset_policy_page_qa_on_evidence_change()
  from public, anon, authenticated, service_role;
revoke all on function app_private.reset_policy_chunk_qa_on_evidence_change()
  from public, anon, authenticated, service_role;

commit;
