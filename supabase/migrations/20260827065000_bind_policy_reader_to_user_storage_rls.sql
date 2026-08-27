begin;

create or replace function api.policy_source_object_is_readable(
  p_object_name text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from app_private.policy_document_versions as version
    join app_private.policy_documents as document
      on document.id = version.document_id
    where p_object_name is not null
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
      and version.storage_path = p_object_name
      and version.storage_path = (
        version.document_id::text || '/' || version.source_sha256 || '.pdf'
      )
      and version.media_type = 'application/pdf'
      and version.byte_size between 5 and 52428800
      and version.page_count is not null
  );
$$;

comment on function api.policy_source_object_is_readable(text) is
  'Returns true only when the current authenticated session may read one exact approved policy-source object path.';

revoke all on function api.policy_source_object_is_readable(text)
  from public, anon, service_role;
grant execute on function api.policy_source_object_is_readable(text)
  to authenticated;

drop policy if exists policy_sources_authenticated_read
  on storage.objects;
create policy policy_sources_authenticated_read
on storage.objects
for select
to authenticated
using (
  bucket_id = 'policy-sources'
  and api.policy_source_object_is_readable(name)
);

commit;
