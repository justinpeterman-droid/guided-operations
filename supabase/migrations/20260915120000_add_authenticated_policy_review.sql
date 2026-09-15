begin;

alter table app_private.admin_step_ups drop constraint admin_step_ups_purpose_check;
alter table app_private.admin_step_ups add constraint admin_step_ups_purpose_check check (
  purpose in (
    'account.create', 'account.reset_passcode', 'account.unlock',
    'account.change_role', 'account.change_shift', 'account.disable',
    'policy.promote', 'policy.review', 'retention.place_legal_hold',
    'retention.release_legal_hold', 'retention.approve_deletion',
    'retention.execute_deletion', 'paperwork.template_import',
    'paperwork.template_rollback', 'system.destructive_cleanup'
  )
);

-- Private server boundary only. Caller identity is obtained from the verified
-- application session, never from operator JSON. The initial ceremony is limited
-- to the source's recorded rights reviewer (the owner under O-028).
create function app_private.policy_review_snapshot(
  p_actor uuid, p_session uuid, p_auth_version integer,
  p_version uuid, p_run uuid
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  actor_staff uuid;
  actor_facility uuid;
  document app_private.policy_documents%rowtype;
  version app_private.policy_document_versions%rowtype;
  ingestion app_private.policy_ingestion_runs%rowtype;
  pages jsonb;
  chunks jsonb;
  snapshot jsonb;
begin
  select staff.id, staff.facility_id into actor_staff, actor_facility
  from app_private.user_accounts account
  join app_private.staff_members staff on staff.id = account.staff_member_id
  join auth.sessions session on session.user_id = account.auth_user_id
  where account.auth_user_id = p_actor and account.auth_version = p_auth_version
    and account.status = 'active' and account.role = 'administrator'
    and not account.must_change_passcode and staff.status = 'active'
    and session.id = p_session
    and (session.not_after is null or session.not_after > statement_timestamp())
  for share of account, staff, session;
  if not found then
    raise exception using errcode = '42501', message = 'Policy review denied';
  end if;

  select d.* into document from app_private.policy_documents d
  join app_private.policy_document_versions v on v.document_id = d.id
  where v.id = p_version and d.facility_id = actor_facility for update of d;
  if not found then
    raise exception using errcode = '42501', message = 'Policy review denied';
  end if;
  select * into version from app_private.policy_document_versions
    where id = p_version for update;
  select * into ingestion from app_private.policy_ingestion_runs
    where id = p_run and document_version_id = p_version for update;
  if not found then
    raise exception using errcode = '22023', message = 'Policy evidence blocked';
  end if;
  if version.rights_reviewed_by is distinct from actor_staff then
    raise exception using errcode = '42501', message = 'Policy review denied';
  end if;
  if document.status not in ('draft', 'approved') or document.collection is null
    or version.lifecycle_status <> 'pending' or version.indexed_at is not null
    or not version.is_current or not version.external_ai_allowed
    or version.rights_status not in ('approved_internal_search', 'approved_full_reader')
    or version.rights_reviewed_at is null or version.rights_evidence_ref is null
    or version.rights_review_due_at is null
    or version.rights_review_due_at <= statement_timestamp()
    or ingestion.environment <> 'production'
    or ingestion.status not in ('awaiting_review', 'ready')
    or ingestion.qa_status = 'rejected' or ingestion.failure_count <> 0
    or ingestion.completed_at is null
    or ingestion.source_sha256 <> version.source_sha256
    or ingestion.collection is distinct from document.collection
    or ingestion.page_count not between 1 and 1000
    or ingestion.chunk_count not between 1 and 2000
    or version.page_count is distinct from ingestion.page_count
    or exists (select 1 from app_private.policy_ingestion_runs other
      where other.document_version_id = p_version and other.id <> p_run
        and other.status not in ('failed', 'quarantined', 'superseded')) then
    raise exception using errcode = '22023', message = 'Policy evidence blocked';
  end if;

  -- The run lock also serializes child INSERT/UPDATE/DELETE through the existing
  -- evidence trigger. Row locks retain exact evidence until this transaction ends.
  perform 1 from app_private.policy_pages where ingestion_run_id = p_run order by id for update;
  perform 1 from app_private.policy_chunks where ingestion_run_id = p_run order by id for update;
  if (select count(*) from app_private.policy_pages where ingestion_run_id = p_run) <> ingestion.page_count
    or (select min(source_page_index) from app_private.policy_pages where ingestion_run_id = p_run) <> 1
    or (select max(source_page_index) from app_private.policy_pages where ingestion_run_id = p_run) <> ingestion.page_count
    or (select count(*) from app_private.policy_chunks where ingestion_run_id = p_run) <> ingestion.chunk_count
    or exists (select 1 from app_private.policy_pages p where p.ingestion_run_id = p_run
      and (p.review_status = 'rejected' or p.document_version_id <> p_version
        or p.normalized_text_sha256 <> encode(extensions.digest(p.normalized_text, 'sha256'), 'hex')))
    or exists (select 1 from app_private.policy_chunks c where c.ingestion_run_id = p_run
      and (c.lifecycle_status not in ('pending', 'active') or c.document_version_id <> p_version
        or c.content_sha256 <> encode(extensions.digest(c.content, 'sha256'), 'hex')
        or c.page_start is null or c.page_end is null
        or c.page_start < 1 or c.page_end > ingestion.page_count
        or c.page_end::bigint - c.page_start::bigint not between 0 and 10)) then
    raise exception using errcode = '22023', message = 'Policy evidence blocked';
  end if;

  select jsonb_agg(jsonb_build_object(
    'page', p.source_page_index, 'textSha256', p.normalized_text_sha256,
    'evidenceSha256', encode(extensions.digest((to_jsonb(p) - 'review_status')::text, 'sha256'), 'hex')
  ) order by p.source_page_index) into pages
  from app_private.policy_pages p where p.ingestion_run_id = p_run;
  select jsonb_agg(jsonb_build_object(
    'id', c.id, 'ordinal', c.ordinal, 'pageStart', c.page_start, 'pageEnd', c.page_end,
    'textSha256', c.content_sha256,
    'evidenceSha256', encode(extensions.digest((to_jsonb(c) - 'qa_approved' - 'lifecycle_status' - 'content_tsv')::text, 'sha256'), 'hex')
  ) order by c.id) into chunks
  from app_private.policy_chunks c where c.ingestion_run_id = p_run;
  snapshot := jsonb_build_object(
    'protocol', 'policy-full-review-v1', 'versionId', p_version, 'runId', p_run,
    'sourceSha256', version.source_sha256, 'pages', pages, 'chunks', chunks,
    'registrySha256', encode(extensions.digest(jsonb_build_object(
      'document', to_jsonb(document) - 'status' - 'updated_at',
      'version', to_jsonb(version) - 'approved_at',
      'run', to_jsonb(ingestion) - 'status' - 'qa_status' - 'qa_reviewed_by' - 'qa_reviewed_at'
    )::text, 'sha256'), 'hex')
  );
  return snapshot;
end;
$$;

create function app_private.approve_policy_review(
  p_actor uuid, p_session uuid, p_auth_version integer,
  p_review jsonb, p_request_id uuid, p_token_digest text
)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  snapshot jsonb;
  submitted jsonb;
  review_digest text;
  receipt app_private.audit_events%rowtype;
  actor_staff uuid;
  actor_facility uuid;
  version_id uuid;
  run_id uuid;
  review_id uuid;
begin
  if jsonb_typeof(p_review) is distinct from 'object'
    or octet_length(p_review::text) > 524288
    or p_request_id is null or p_token_digest is null
    or p_token_digest !~ '^[A-Za-z0-9_-]{40,}$'
    or p_review->>'protocol' is distinct from 'policy-full-review-v1'
    or p_review->'sourceReviewed' is distinct from 'true'::jsonb
    or coalesce(p_review->>'reviewRecordSha256', '') !~ '^[a-f0-9]{64}$'
    or jsonb_typeof(p_review->'pages') is distinct from 'array'
    or jsonb_typeof(p_review->'chunks') is distinct from 'array' then
    raise exception using errcode = '22023', message = 'Invalid policy review';
  end if;
  version_id := (p_review->>'versionId')::uuid;
  run_id := (p_review->>'runId')::uuid;
  review_id := (p_review->>'reviewId')::uuid;
  if version_id is null or run_id is null or review_id is null then
    raise exception using errcode = '22023', message = 'Invalid policy review';
  end if;
  snapshot := app_private.policy_review_snapshot(p_actor, p_session, p_auth_version, version_id, run_id);
  if exists (select 1 from jsonb_array_elements(p_review->'pages') p where p->'reviewed' is distinct from 'true'::jsonb)
    or exists (select 1 from jsonb_array_elements(p_review->'chunks') c where c->'reviewed' is distinct from 'true'::jsonb) then
    raise exception using errcode = '22023', message = 'Incomplete policy review';
  end if;
  submitted := p_review - 'reviewId' - 'sourceReviewed' - 'reviewRecordSha256';
  submitted := jsonb_set(submitted, '{pages}', (
    select coalesce(jsonb_agg(p - 'reviewed' order by (p->>'page')::integer), '[]'::jsonb)
    from jsonb_array_elements(p_review->'pages') p));
  submitted := jsonb_set(submitted, '{chunks}', (
    select coalesce(jsonb_agg(c - 'reviewed' order by (c->>'id')::uuid), '[]'::jsonb)
    from jsonb_array_elements(p_review->'chunks') c));
  if submitted is distinct from snapshot then
    raise exception using errcode = '40001', message = 'Policy review evidence changed';
  end if;
  review_digest := encode(extensions.digest(p_review::text, 'sha256'), 'hex');
  -- A fresh proof is needed even for a retry; it is consumed in the same
  -- transaction as QA changes and the append-only, content-free receipt.
  if not app_private.consume_admin_step_up(p_actor, p_session, p_auth_version,
    'policy.review', p_token_digest, p_request_id) then
    raise exception using errcode = '42501', message = 'Policy review denied';
  end if;
  select * into receipt from app_private.audit_events where event_id = review_id;
  if found then
    if receipt.actor_auth_user_id = p_actor and receipt.target_id = version_id
      and receipt.event_type = 'policy.qa_approved'
      and receipt.metadata->>'review_digest' = review_digest
      and exists (select 1 from app_private.policy_ingestion_runs where id = run_id
        and status = 'ready' and qa_status = 'approved')
      and exists (select 1 from app_private.policy_document_versions v
        join app_private.policy_documents d on d.id = v.document_id
        where v.id = version_id and v.approved_at is not null and d.status = 'approved') then
      return 'already_approved';
    end if;
    raise exception using errcode = '40001', message = 'Policy review receipt conflict';
  end if;
  if not exists (select 1 from app_private.policy_ingestion_runs where id = run_id
    and status = 'awaiting_review' and qa_status = 'pending')
    or exists (select 1 from app_private.policy_document_versions where id = version_id and approved_at is not null) then
    raise exception using errcode = '40001', message = 'Policy review state conflict';
  end if;
  select staff.id, staff.facility_id into strict actor_staff, actor_facility
    from app_private.user_accounts account join app_private.staff_members staff on staff.id = account.staff_member_id
    where account.auth_user_id = p_actor;
  update app_private.policy_pages set review_status = 'approved' where ingestion_run_id = run_id;
  update app_private.policy_chunks set qa_approved = true, lifecycle_status = 'active' where ingestion_run_id = run_id;
  update app_private.policy_ingestion_runs set status = 'ready', qa_status = 'approved',
    qa_reviewed_by = actor_staff, qa_reviewed_at = statement_timestamp() where id = run_id;
  update app_private.policy_document_versions set approved_at = statement_timestamp() where id = version_id;
  update app_private.policy_documents set status = 'approved'
    where id = (select document_id from app_private.policy_document_versions where id = version_id);
  insert into app_private.audit_events(event_id, facility_id, actor_auth_user_id,
    event_type, target_type, target_id, request_id, metadata)
  values (review_id, actor_facility, p_actor, 'policy.qa_approved', 'policy_version', version_id, p_request_id,
    jsonb_build_object('protocol', 'policy-full-review-v1', 'run_id', run_id,
      'review_digest', review_digest, 'review_record_sha256', p_review->>'reviewRecordSha256',
      'page_count', jsonb_array_length(snapshot->'pages'),
      'chunk_count', jsonb_array_length(snapshot->'chunks')));
  return 'approved_for_embedding';
end;
$$;

revoke all on function app_private.policy_review_snapshot(uuid, uuid, integer, uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function app_private.approve_policy_review(uuid, uuid, integer, jsonb, uuid, text)
  from public, anon, authenticated, service_role;

comment on function app_private.approve_policy_review(uuid, uuid, integer, jsonb, uuid, text) is
  'Private exact-evidence QA ceremony for the authenticated owner; preserves pending/unindexed version state. No embedding or searchable activation.';

commit;
