begin;

create or replace function api.get_policy_source_reader(
  p_document_version_id uuid
)
returns table (
  document_id uuid,
  document_version_id uuid,
  stable_key text,
  title text,
  version_label text,
  source_sha256 text,
  storage_bucket text,
  storage_path text,
  media_type text,
  byte_size bigint,
  page_count integer,
  lifecycle_status text,
  is_current boolean,
  effective_on date
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    document.id,
    version.id,
    document.stable_key,
    document.title,
    version.version_label,
    version.source_sha256,
    version.storage_bucket,
    version.storage_path,
    version.media_type,
    version.byte_size,
    version.page_count,
    version.lifecycle_status::text,
    version.is_current,
    version.effective_on
  from app_private.policy_document_versions as version
  join app_private.policy_documents as document
    on document.id = version.document_id
  where p_document_version_id is not null
    and version.id = p_document_version_id
    and document.facility_id = app_private.current_policy_facility_id()
    and document.status = 'approved'
    and version.approved_at is not null
    and version.rights_status = 'approved_full_reader'
    and version.rights_reviewed_at is not null
    and (
      version.rights_review_due_at is null
      or version.rights_review_due_at > statement_timestamp()
    )
    and (
      (version.lifecycle_status = 'active' and version.is_current)
      or (version.lifecycle_status = 'superseded' and not version.is_current)
    )
    and version.storage_bucket = 'policy-sources'
    and version.storage_path = (
      version.document_id::text || '/' || version.source_sha256 || '.pdf'
    )
    and version.media_type = 'application/pdf'
    and version.byte_size between 5 and 52428800
    and version.page_count is not null
  limit 1;
$$;

comment on function api.get_policy_source_reader(uuid) is
  'Returns one exact current-session-authorized PDF source descriptor for a current or retained superseded full-reader policy version.';

revoke all on function api.get_policy_source_reader(uuid)
  from public, anon, service_role;
grant execute on function api.get_policy_source_reader(uuid)
  to authenticated;

commit;
