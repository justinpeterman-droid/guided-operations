begin;

alter table app_private.admin_step_ups
  drop constraint admin_step_ups_purpose_check;

alter table app_private.admin_step_ups
  add constraint admin_step_ups_purpose_check check (
    purpose in (
      'account.create',
      'account.reset_passcode',
      'account.unlock',
      'account.change_role',
      'account.change_shift',
      'account.disable',
      'policy.promote',
      'retention.place_legal_hold',
      'retention.release_legal_hold',
      'retention.approve_deletion',
      'retention.execute_deletion',
      'system.destructive_cleanup'
    )
  );

create table app_private.record_artifacts (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null
    references app_private.facilities(id) on delete restrict,
  record_type text not null check (
    record_type in ('incident', 'report', 'paperwork_record')
  ),
  record_id uuid not null,
  artifact_kind text not null check (artifact_kind = 'generated_export'),
  storage_bucket text not null check (storage_bucket = 'generated-exports'),
  storage_path text not null check (
    storage_path !~ '(^|/)\.\.(/|$)'
    and storage_path !~ '^/'
    and char_length(storage_path) between 1 and 1024
  ),
  media_type text not null check (
    media_type in (
      'application/pdf',
      'application/zip',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    )
  ),
  byte_size bigint not null check (byte_size between 1 and 52428800),
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  created_by_account_id uuid not null
    references app_private.user_accounts(auth_user_id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  deleted_at timestamptz,
  deletion_request_id uuid,
  unique (storage_bucket, storage_path),
  check (
    (deleted_at is null and deletion_request_id is null)
    or (deleted_at is not null and deletion_request_id is not null)
  )
);

comment on table app_private.record_artifacts is
  'Private integrity registry for controlled generated exports. Object bytes remain in private Storage and every deletion is bound to a retention request.';

create index record_artifacts_active_record_idx
  on app_private.record_artifacts (facility_id, record_type, record_id, id)
  where deleted_at is null;

create table app_private.retention_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null
    references app_private.facilities(id) on delete restrict,
  record_type text not null check (
    record_type in ('incident', 'paperwork_record')
  ),
  record_id uuid not null,
  authority_reference text not null check (
    char_length(authority_reference) between 3 and 160
    and authority_reference ~ '^[A-Za-z0-9][A-Za-z0-9 ._:/-]*$'
  ),
  database_backup_reference text not null check (
    char_length(database_backup_reference) between 3 and 160
    and database_backup_reference ~ '^[A-Za-z0-9][A-Za-z0-9 ._:/-]*$'
  ),
  storage_backup_reference text not null check (
    char_length(storage_backup_reference) between 3 and 160
    and storage_backup_reference ~ '^[A-Za-z0-9][A-Za-z0-9 ._:/-]*$'
  ),
  backup_manifest_sha256 text not null check (
    backup_manifest_sha256 ~ '^[a-f0-9]{64}$'
  ),
  backup_verified_at timestamptz not null,
  backup_expires_at timestamptz not null,
  artifact_manifest_sha256 text not null check (
    artifact_manifest_sha256 ~ '^[a-f0-9]{64}$'
  ),
  artifact_count integer not null check (artifact_count between 0 and 10000),
  artifacts_deleted_count integer not null default 0 check (
    artifacts_deleted_count between 0 and artifact_count
  ),
  artifact_cleanup_verified_at timestamptz,
  approved_by_account_id uuid not null
    references app_private.user_accounts(auth_user_id) on delete restrict,
  approved_at timestamptz not null default statement_timestamp(),
  approval_expires_at timestamptz not null,
  status text not null default 'approved' check (
    status in ('approved', 'executing', 'completed', 'canceled')
  ),
  executed_by_account_id uuid
    references app_private.user_accounts(auth_user_id) on delete restrict,
  executed_at timestamptz,
  execution_backend_pid integer,
  execution_transaction_id bigint,
  database_rows_deleted integer check (database_rows_deleted >= 0),
  completed_at timestamptz,
  canceled_at timestamptz,
  check (backup_verified_at <= approved_at),
  check (backup_expires_at > approval_expires_at),
  check (approval_expires_at > approved_at),
  check (
    (status = 'approved'
      and executed_by_account_id is null
      and executed_at is null
      and execution_backend_pid is null
      and execution_transaction_id is null
      and database_rows_deleted is null
      and completed_at is null
      and canceled_at is null)
    or (status = 'executing'
      and executed_by_account_id is not null
      and executed_at is not null
      and execution_backend_pid is not null
      and execution_transaction_id is not null
      and database_rows_deleted is null
      and completed_at is null
      and canceled_at is null)
    or (status = 'completed'
      and executed_by_account_id is not null
      and executed_at is not null
      and execution_backend_pid is not null
      and execution_transaction_id is not null
      and database_rows_deleted is not null
      and completed_at is not null
      and canceled_at is null)
    or (status = 'canceled'
      and executed_by_account_id is null
      and executed_at is null
      and execution_backend_pid is null
      and execution_transaction_id is null
      and database_rows_deleted is null
      and completed_at is null
      and canceled_at is not null)
  )
);

comment on table app_private.retention_deletion_requests is
  'Metadata-only, backup-aware approval and completion evidence for controlled operational-record deletion. Record bodies and object paths do not belong here.';

alter table app_private.record_artifacts
  add constraint record_artifacts_deletion_request_fkey
  foreign key (deletion_request_id)
  references app_private.retention_deletion_requests(id)
  on delete restrict;

create unique index retention_deletion_requests_one_open_target_idx
  on app_private.retention_deletion_requests (facility_id, record_type, record_id)
  where status in ('approved', 'executing');

create index retention_deletion_requests_facility_status_idx
  on app_private.retention_deletion_requests (
    facility_id, status, approved_at desc, id
  );

create or replace function app_private.acquire_retention_scope_lock(
  p_facility_id uuid,
  p_scope_type text,
  p_scope_id uuid
)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  select pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_facility_id::text || ':' || p_scope_type || ':' || p_scope_id::text,
      0
    )
  );
$$;

comment on function app_private.acquire_retention_scope_lock(uuid, text, uuid) is
  'Private transaction lock that serializes legal-hold and deletion decisions for one facility-scoped record.';

revoke all on function app_private.acquire_retention_scope_lock(uuid, text, uuid)
  from public, anon, authenticated, service_role;

create or replace function app_private.place_legal_hold(
  p_actor_auth_user_id uuid,
  p_facility_id uuid,
  p_scope_type text,
  p_scope_id uuid,
  p_authority_reference text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  hold_id uuid;
begin
  perform 1
  from app_private.user_accounts as account
  join app_private.staff_members as staff on staff.id = account.staff_member_id
  where account.auth_user_id = p_actor_auth_user_id
    and account.role = 'administrator'
    and account.status = 'active'
    and staff.status = 'active'
    and staff.facility_id = p_facility_id;

  if not found then
    raise exception 'Active same-facility administrator required';
  end if;

  perform app_private.acquire_retention_scope_lock(
    p_facility_id, p_scope_type, p_scope_id
  );

  insert into app_private.legal_holds (
    facility_id,
    scope_type,
    scope_id,
    authority_reference,
    created_by_account_id
  ) values (
    p_facility_id,
    p_scope_type,
    p_scope_id,
    p_authority_reference,
    p_actor_auth_user_id
  ) returning id into hold_id;

  insert into app_private.audit_events (
    facility_id,
    actor_auth_user_id,
    event_type,
    target_type,
    target_id,
    metadata
  ) values (
    p_facility_id,
    p_actor_auth_user_id,
    'retention.legal_hold.placed',
    'legal_hold',
    hold_id,
    jsonb_build_object('scope_type', p_scope_type)
  );

  return hold_id;
end;
$$;

revoke all on function app_private.place_legal_hold(uuid, uuid, text, uuid, text)
  from public, anon, authenticated, service_role;

create or replace function app_private.validate_record_artifact_target()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_facility_id uuid;
  expected_prefix text;
begin
  case new.record_type
    when 'incident' then
      select incident.facility_id into target_facility_id
      from app_private.incidents as incident
      where incident.id = new.record_id;
    when 'report' then
      select incident.facility_id into target_facility_id
      from app_private.reports as report
      join app_private.incidents as incident on incident.id = report.incident_id
      where report.id = new.record_id;
    when 'paperwork_record' then
      select record.facility_id into target_facility_id
      from app_private.paperwork_records as record
      where record.id = new.record_id;
    else
      raise exception 'Unsupported artifact record type';
  end case;

  if target_facility_id is null or target_facility_id <> new.facility_id then
    raise exception 'Artifact target does not belong to the facility';
  end if;

  expected_prefix := new.facility_id::text || '/' || new.record_type || '/'
    || new.record_id::text || '/';
  if new.storage_path not like expected_prefix || '%' then
    raise exception 'Artifact path does not match its facility-scoped record';
  end if;

  perform app_private.acquire_retention_scope_lock(
    new.facility_id, new.record_type, new.record_id
  );

  return new;
end;
$$;

revoke all on function app_private.validate_record_artifact_target()
  from public, anon, authenticated, service_role;

create trigger record_artifacts_validate_target
before insert on app_private.record_artifacts
for each row execute function app_private.validate_record_artifact_target();

create or replace function app_private.protect_record_artifact()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Record artifact evidence cannot be deleted';
  end if;

  if old.deleted_at is not null
    or new.id <> old.id
    or new.facility_id <> old.facility_id
    or new.record_type <> old.record_type
    or new.record_id <> old.record_id
    or new.artifact_kind <> old.artifact_kind
    or new.storage_bucket <> old.storage_bucket
    or new.storage_path <> old.storage_path
    or new.media_type <> old.media_type
    or new.byte_size <> old.byte_size
    or new.sha256 <> old.sha256
    or new.created_by_account_id <> old.created_by_account_id
    or new.created_at <> old.created_at
    or new.deleted_at is null
    or new.deletion_request_id is null then
    raise exception 'Record artifact identity and integrity evidence are immutable';
  end if;

  return new;
end;
$$;

revoke all on function app_private.protect_record_artifact()
  from public, anon, authenticated, service_role;

create trigger record_artifacts_protect_evidence
before update or delete on app_private.record_artifacts
for each row execute function app_private.protect_record_artifact();

create or replace function app_private.retention_artifact_manifest(
  p_facility_id uuid,
  p_record_type text,
  p_record_id uuid
)
returns table (artifact_count integer, manifest_sha256 text)
language sql
stable
security definer
set search_path = ''
as $$
  with target_artifacts as (
    select artifact.id, artifact.storage_bucket, artifact.storage_path,
      artifact.sha256, artifact.byte_size
    from app_private.record_artifacts as artifact
    where artifact.facility_id = p_facility_id
      and artifact.deleted_at is null
      and (
        (p_record_type = 'paperwork_record'
          and artifact.record_type = 'paperwork_record'
          and artifact.record_id = p_record_id)
        or (p_record_type = 'incident' and (
          (artifact.record_type = 'incident' and artifact.record_id = p_record_id)
          or (artifact.record_type = 'report' and exists (
            select 1 from app_private.reports as report
            where report.id = artifact.record_id
              and report.incident_id = p_record_id
          ))
        ))
      )
    order by artifact.id
  )
  select
    count(*)::integer,
    encode(
      extensions.digest(
        coalesce(string_agg(
          id::text || ':' || storage_bucket || ':' || storage_path || ':'
            || sha256 || ':' || byte_size::text,
          E'\n' order by id
        ), ''),
        'sha256'
      ),
      'hex'
    )
  from target_artifacts;
$$;

revoke all on function app_private.retention_artifact_manifest(uuid, text, uuid)
  from public, anon, authenticated, service_role;

create or replace function app_private.assert_retention_target_ready(
  p_facility_id uuid,
  p_record_type text,
  p_record_id uuid,
  p_as_of timestamptz
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_as_of is null or p_as_of > statement_timestamp() + interval '1 minute' then
    raise exception 'Retention decision time is invalid';
  end if;

  if p_record_type not in ('incident', 'paperwork_record') then
    raise exception 'Only incident packages and paperwork records can be deleted';
  end if;

  if not exists (
    select 1
    from app_private.record_retention_status(p_as_of) as status
    where status.facility_id = p_facility_id
      and status.record_type = p_record_type
      and status.record_id = p_record_id
      and status.deletion_ready
  ) then
    raise exception 'Retention target is not eligible or is protected by a hold';
  end if;

  if p_record_type = 'incident' and (
    exists (
      select 1 from app_private.reports as report
      where report.incident_id = p_record_id
        and report.archived_at is null
    )
    or exists (
      select 1
      from app_private.reports as report
      left join app_private.record_retention_status(p_as_of) as status
        on status.record_type = 'report'
        and status.record_id = report.id
        and status.facility_id = p_facility_id
      where report.incident_id = p_record_id
        and status.deletion_ready is distinct from true
    )
  ) then
    raise exception 'Every report in an incident package must be eligible and free of holds';
  end if;
end;
$$;

revoke all on function app_private.assert_retention_target_ready(uuid, text, uuid, timestamptz)
  from public, anon, authenticated, service_role;

create or replace function app_private.approve_retention_deletion(
  p_actor_auth_user_id uuid,
  p_record_type text,
  p_record_id uuid,
  p_authority_reference text,
  p_database_backup_reference text,
  p_storage_backup_reference text,
  p_backup_manifest_sha256 text,
  p_backup_verified_at timestamptz,
  p_backup_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_facility_id uuid;
  request_id uuid;
  manifest record;
  child_report record;
  decision_time timestamptz := statement_timestamp();
begin
  if p_record_id is null
    or p_record_type not in ('incident', 'paperwork_record')
    or char_length(coalesce(p_authority_reference, '')) not between 3 and 160
    or p_authority_reference !~ '^[A-Za-z0-9][A-Za-z0-9 ._:/-]*$'
    or char_length(coalesce(p_database_backup_reference, '')) not between 3 and 160
    or p_database_backup_reference !~ '^[A-Za-z0-9][A-Za-z0-9 ._:/-]*$'
    or char_length(coalesce(p_storage_backup_reference, '')) not between 3 and 160
    or p_storage_backup_reference !~ '^[A-Za-z0-9][A-Za-z0-9 ._:/-]*$'
    or p_backup_manifest_sha256 !~ '^[a-f0-9]{64}$'
    or p_backup_verified_at is null
    or p_backup_verified_at > decision_time
    or p_backup_verified_at < decision_time - interval '24 hours'
    or p_backup_expires_at is null
    or p_backup_expires_at <= decision_time + interval '24 hours' then
    raise exception 'Invalid retention deletion approval evidence';
  end if;

  select staff.facility_id into actor_facility_id
  from app_private.user_accounts as account
  join app_private.staff_members as staff on staff.id = account.staff_member_id
  where account.auth_user_id = p_actor_auth_user_id
    and account.role = 'administrator'
    and account.status = 'active'
    and staff.status = 'active';

  if not found then
    raise exception 'Current active administrator required';
  end if;

  perform app_private.acquire_retention_scope_lock(
    actor_facility_id, 'facility', actor_facility_id
  );
  perform app_private.acquire_retention_scope_lock(
    actor_facility_id, p_record_type, p_record_id
  );
  if p_record_type = 'incident' then
    for child_report in
      select report.id from app_private.reports as report
      where report.incident_id = p_record_id
      order by report.id
    loop
      perform app_private.acquire_retention_scope_lock(
        actor_facility_id, 'report', child_report.id
      );
    end loop;
  end if;

  perform app_private.assert_retention_target_ready(
    actor_facility_id, p_record_type, p_record_id, decision_time
  );

  select * into manifest
  from app_private.retention_artifact_manifest(
    actor_facility_id, p_record_type, p_record_id
  );

  insert into app_private.retention_deletion_requests (
    facility_id,
    record_type,
    record_id,
    authority_reference,
    database_backup_reference,
    storage_backup_reference,
    backup_manifest_sha256,
    backup_verified_at,
    backup_expires_at,
    artifact_manifest_sha256,
    artifact_count,
    approved_by_account_id,
    approved_at,
    approval_expires_at
  ) values (
    actor_facility_id,
    p_record_type,
    p_record_id,
    p_authority_reference,
    p_database_backup_reference,
    p_storage_backup_reference,
    p_backup_manifest_sha256,
    p_backup_verified_at,
    p_backup_expires_at,
    manifest.manifest_sha256,
    manifest.artifact_count,
    p_actor_auth_user_id,
    decision_time,
    decision_time + interval '24 hours'
  ) returning id into request_id;

  insert into app_private.audit_events (
    facility_id, actor_auth_user_id, event_type, target_type, target_id, metadata
  ) values (
    actor_facility_id,
    p_actor_auth_user_id,
    'retention.deletion.approved',
    'retention_deletion_request',
    request_id,
    jsonb_build_object(
      'record_type', p_record_type,
      'artifact_count', manifest.artifact_count
    )
  );

  return request_id;
end;
$$;

comment on function app_private.approve_retention_deletion(uuid, text, uuid, text, text, text, text, timestamptz, timestamptz) is
  'Private backup-aware approval for one eligible incident package or paperwork record. It does not delete anything.';

revoke all on function app_private.approve_retention_deletion(uuid, text, uuid, text, text, text, text, timestamptz, timestamptz)
  from public, anon, authenticated, service_role;

create or replace function app_private.list_retention_deletion_requests(
  p_actor_auth_user_id uuid,
  p_include_completed boolean,
  p_limit integer
)
returns table (
  request_id uuid,
  record_type text,
  record_id uuid,
  authority_reference text,
  database_backup_reference text,
  storage_backup_reference text,
  backup_verified_at timestamptz,
  backup_expires_at timestamptz,
  artifact_count integer,
  artifacts_deleted_count integer,
  status text,
  approved_at timestamptz,
  approval_expires_at timestamptz,
  completed_at timestamptz,
  database_rows_deleted integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_facility_id uuid;
begin
  if p_include_completed is null then
    raise exception 'Deletion request completion filter is required';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 200 then
    raise exception 'Deletion request limit must be between 1 and 200';
  end if;

  select staff.facility_id into actor_facility_id
  from app_private.user_accounts as account
  join app_private.staff_members as staff on staff.id = account.staff_member_id
  where account.auth_user_id = p_actor_auth_user_id
    and account.role = 'administrator'
    and account.status = 'active'
    and staff.status = 'active';
  if not found then
    raise exception 'Current active administrator required';
  end if;

  return query
  select request.id, request.record_type, request.record_id,
    request.authority_reference, request.database_backup_reference,
    request.storage_backup_reference, request.backup_verified_at,
    request.backup_expires_at, request.artifact_count,
    request.artifacts_deleted_count, request.status, request.approved_at,
    request.approval_expires_at, request.completed_at,
    request.database_rows_deleted
  from app_private.retention_deletion_requests as request
  where request.facility_id = actor_facility_id
    and (p_include_completed or request.status in ('approved', 'executing'))
  order by
    (request.status in ('approved', 'executing')) desc,
    request.approved_at desc,
    request.id
  limit p_limit;
end;
$$;

comment on function app_private.list_retention_deletion_requests(uuid, boolean, integer) is
  'Private bounded same-facility administrator register of metadata-only deletion approvals and completion evidence.';

revoke all on function app_private.list_retention_deletion_requests(uuid, boolean, integer)
  from public, anon, authenticated, service_role;

create or replace function app_private.list_retention_deletion_artifacts(
  p_actor_auth_user_id uuid,
  p_request_id uuid
)
returns table (
  artifact_id uuid,
  storage_bucket text,
  storage_path text,
  sha256 text,
  byte_size bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  request app_private.retention_deletion_requests%rowtype;
begin
  select candidate.* into request
  from app_private.retention_deletion_requests as candidate
  join app_private.user_accounts as account
    on account.auth_user_id = p_actor_auth_user_id
  join app_private.staff_members as staff on staff.id = account.staff_member_id
  where candidate.id = p_request_id
    and candidate.facility_id = staff.facility_id
    and account.role = 'administrator'
    and account.status = 'active'
    and staff.status = 'active';

  if not found then
    raise exception 'Current same-facility administrator required';
  end if;

  return query
  select artifact.id, artifact.storage_bucket, artifact.storage_path,
    artifact.sha256, artifact.byte_size
  from app_private.record_artifacts as artifact
  where artifact.facility_id = request.facility_id
    and artifact.deleted_at is null
    and (
      (request.record_type = 'paperwork_record'
        and artifact.record_type = 'paperwork_record'
        and artifact.record_id = request.record_id)
      or (request.record_type = 'incident' and (
        (artifact.record_type = 'incident' and artifact.record_id = request.record_id)
        or (artifact.record_type = 'report' and exists (
          select 1 from app_private.reports as report
          where report.id = artifact.record_id
            and report.incident_id = request.record_id
        ))
      ))
    )
  order by artifact.id;
end;
$$;

revoke all on function app_private.list_retention_deletion_artifacts(uuid, uuid)
  from public, anon, authenticated, service_role;

create or replace function app_private.begin_retention_deletion(
  p_actor_auth_user_id uuid,
  p_request_id uuid,
  p_confirm_record_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  request app_private.retention_deletion_requests%rowtype;
  child_report record;
  decision_time timestamptz := statement_timestamp();
begin
  select candidate.* into request
  from app_private.retention_deletion_requests as candidate
  join app_private.user_accounts as account
    on account.auth_user_id = p_actor_auth_user_id
  join app_private.staff_members as staff on staff.id = account.staff_member_id
  where candidate.id = p_request_id
    and candidate.facility_id = staff.facility_id
    and account.role = 'administrator'
    and account.status = 'active'
    and staff.status = 'active'
  for update of candidate;

  if p_confirm_record_id is null
    or not found
    or request.status <> 'approved'
    or request.record_id <> p_confirm_record_id
    or request.approval_expires_at <= decision_time
    or request.backup_expires_at <= decision_time then
    raise exception 'Executable retention deletion approval required';
  end if;

  perform app_private.acquire_retention_scope_lock(
    request.facility_id, 'facility', request.facility_id
  );
  perform app_private.acquire_retention_scope_lock(
    request.facility_id, request.record_type, request.record_id
  );
  if request.record_type = 'incident' then
    for child_report in
      select report.id from app_private.reports as report
      where report.incident_id = request.record_id
      order by report.id
    loop
      perform app_private.acquire_retention_scope_lock(
        request.facility_id, 'report', child_report.id
      );
    end loop;
  end if;

  perform app_private.assert_retention_target_ready(
    request.facility_id, request.record_type, request.record_id, decision_time
  );

  update app_private.retention_deletion_requests
  set status = 'executing',
      executed_by_account_id = p_actor_auth_user_id,
      executed_at = decision_time,
      execution_backend_pid = pg_backend_pid(),
      execution_transaction_id = txid_current()
  where id = request.id;

  perform set_config(
    'app.retention_deletion_request_id', request.id::text, true
  );

  return true;
end;
$$;

comment on function app_private.begin_retention_deletion(uuid, uuid, uuid) is
  'Starts one deletion inside the caller transaction, locks every legal-hold scope, and binds all remaining steps to the same backend transaction.';

revoke all on function app_private.begin_retention_deletion(uuid, uuid, uuid)
  from public, anon, authenticated, service_role;

create or replace function app_private.mark_retention_artifact_deleted(
  p_actor_auth_user_id uuid,
  p_request_id uuid,
  p_artifact_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  request app_private.retention_deletion_requests%rowtype;
begin
  select candidate.* into request
  from app_private.retention_deletion_requests as candidate
  join app_private.user_accounts as account
    on account.auth_user_id = p_actor_auth_user_id
  join app_private.staff_members as staff on staff.id = account.staff_member_id
  where candidate.id = p_request_id
    and candidate.facility_id = staff.facility_id
    and account.role = 'administrator'
    and account.status = 'active'
    and staff.status = 'active'
  for update of candidate;

  if not found
    or request.status <> 'executing'
    or request.executed_by_account_id <> p_actor_auth_user_id
    or request.execution_backend_pid <> pg_backend_pid()
    or request.execution_transaction_id <> txid_current()
    or request.approval_expires_at <= statement_timestamp() then
    raise exception 'Active same-transaction deletion execution required';
  end if;

  update app_private.record_artifacts as artifact
  set deleted_at = statement_timestamp(), deletion_request_id = request.id
  where artifact.id = p_artifact_id
    and artifact.facility_id = request.facility_id
    and artifact.deleted_at is null
    and (
      (request.record_type = 'paperwork_record'
        and artifact.record_type = 'paperwork_record'
        and artifact.record_id = request.record_id)
      or (request.record_type = 'incident' and (
        (artifact.record_type = 'incident' and artifact.record_id = request.record_id)
        or (artifact.record_type = 'report' and exists (
          select 1 from app_private.reports as report
          where report.id = artifact.record_id
            and report.incident_id = request.record_id
        ))
      ))
    );

  if not found then
    raise exception 'Approved artifact was not found';
  end if;

  return true;
end;
$$;

revoke all on function app_private.mark_retention_artifact_deleted(uuid, uuid, uuid)
  from public, anon, authenticated, service_role;

create or replace function app_private.verify_retention_artifact_cleanup(
  p_actor_auth_user_id uuid,
  p_request_id uuid,
  p_observed_manifest_sha256 text,
  p_remaining_objects integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  request app_private.retention_deletion_requests%rowtype;
  deleted_count integer;
begin
  if p_observed_manifest_sha256 !~ '^[a-f0-9]{64}$'
    or p_remaining_objects is null
    or p_remaining_objects <> 0 then
    raise exception 'Storage cleanup evidence is incomplete';
  end if;

  select candidate.* into request
  from app_private.retention_deletion_requests as candidate
  join app_private.user_accounts as account
    on account.auth_user_id = p_actor_auth_user_id
  join app_private.staff_members as staff on staff.id = account.staff_member_id
  where candidate.id = p_request_id
    and candidate.facility_id = staff.facility_id
    and account.role = 'administrator'
    and account.status = 'active'
    and staff.status = 'active'
  for update of candidate;

  if not found
    or request.status <> 'executing'
    or request.executed_by_account_id <> p_actor_auth_user_id
    or request.execution_backend_pid <> pg_backend_pid()
    or request.execution_transaction_id <> txid_current()
    or request.approval_expires_at <= statement_timestamp()
    or request.artifact_manifest_sha256 <> p_observed_manifest_sha256 then
    raise exception 'Active same-transaction matching deletion execution required';
  end if;

  select count(*)::integer into deleted_count
  from app_private.record_artifacts as artifact
  where artifact.deletion_request_id = request.id
    and artifact.deleted_at is not null;

  if deleted_count <> request.artifact_count then
    raise exception 'Not every approved Storage artifact has deletion evidence';
  end if;

  update app_private.retention_deletion_requests
  set artifacts_deleted_count = deleted_count,
      artifact_cleanup_verified_at = statement_timestamp()
  where id = request.id;

  return true;
end;
$$;

revoke all on function app_private.verify_retention_artifact_cleanup(uuid, uuid, text, integer)
  from public, anon, authenticated, service_role;

create or replace function app_private.retention_delete_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_id uuid;
  request app_private.retention_deletion_requests%rowtype;
  allowed boolean := false;
begin
  if tg_op <> 'DELETE' then
    raise exception 'Rows in %.% are append-only', tg_table_schema, tg_table_name;
  end if;

  begin
    request_id := nullif(
      current_setting('app.retention_deletion_request_id', true), ''
    )::uuid;
  exception when invalid_text_representation then
    request_id := null;
  end;

  select * into request
  from app_private.retention_deletion_requests
  where id = request_id and status = 'executing';
  if not found then
    raise exception 'Rows in %.% are append-only', tg_table_schema, tg_table_name;
  end if;

  if tg_table_name = 'incident_revisions' then
    allowed := request.record_type = 'incident'
      and old.incident_id = request.record_id;
  elsif tg_table_name = 'report_revisions' then
    allowed := request.record_type = 'incident' and exists (
      select 1 from app_private.reports as report
      where report.id = old.report_id
        and report.incident_id = request.record_id
    );
  elsif tg_table_name = 'report_draft_candidates' then
    allowed := request.record_type = 'incident'
      and old.incident_id = request.record_id;
  elsif tg_table_name = 'paperwork_revisions' then
    allowed := request.record_type = 'paperwork_record'
      and old.paperwork_record_id = request.record_id;
  end if;

  if not allowed then
    raise exception 'Retention deletion context does not match %.%',
      tg_table_schema, tg_table_name;
  end if;

  return old;
end;
$$;

revoke all on function app_private.retention_delete_guard()
  from public, anon, authenticated, service_role;

drop trigger incident_revisions_immutable on app_private.incident_revisions;
create trigger incident_revisions_immutable
before update or delete on app_private.incident_revisions
for each row execute function app_private.retention_delete_guard();

drop trigger report_revisions_immutable on app_private.report_revisions;
create trigger report_revisions_immutable
before update or delete on app_private.report_revisions
for each row execute function app_private.retention_delete_guard();

drop trigger report_draft_candidates_immutable on app_private.report_draft_candidates;
create trigger report_draft_candidates_immutable
before update or delete on app_private.report_draft_candidates
for each row execute function app_private.retention_delete_guard();

drop trigger paperwork_revisions_immutable on app_private.paperwork_revisions;
create trigger paperwork_revisions_immutable
before update or delete on app_private.paperwork_revisions
for each row execute function app_private.retention_delete_guard();

create or replace function app_private.complete_retention_deletion(
  p_actor_auth_user_id uuid,
  p_request_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  request app_private.retention_deletion_requests%rowtype;
  deleted_rows integer := 0;
  affected_rows integer;
begin
  select candidate.* into request
  from app_private.retention_deletion_requests as candidate
  join app_private.user_accounts as account
    on account.auth_user_id = p_actor_auth_user_id
  join app_private.staff_members as staff on staff.id = account.staff_member_id
  where candidate.id = p_request_id
    and candidate.facility_id = staff.facility_id
    and account.role = 'administrator'
    and account.status = 'active'
    and staff.status = 'active'
  for update of candidate;

  if not found
    or request.status <> 'executing'
    or request.executed_by_account_id <> p_actor_auth_user_id
    or request.execution_backend_pid <> pg_backend_pid()
    or request.execution_transaction_id <> txid_current()
    or request.approval_expires_at <= statement_timestamp()
    or request.backup_expires_at <= statement_timestamp()
    or request.artifact_cleanup_verified_at is null
    or request.artifacts_deleted_count <> request.artifact_count then
    raise exception 'Active same-transaction deletion execution required';
  end if;

  perform app_private.assert_retention_target_ready(
    request.facility_id,
    request.record_type,
    request.record_id,
    statement_timestamp()
  );

  perform set_config(
    'app.retention_deletion_request_id', request.id::text, true
  );

  if request.record_type = 'incident' then
    delete from app_private.report_draft_candidates
    where incident_id = request.record_id;
    get diagnostics affected_rows = row_count;
    deleted_rows := deleted_rows + affected_rows;

    delete from app_private.report_access
    where report_id in (
      select report.id from app_private.reports as report
      where report.incident_id = request.record_id
    );
    get diagnostics affected_rows = row_count;
    deleted_rows := deleted_rows + affected_rows;

    delete from app_private.report_revisions
    where report_id in (
      select report.id from app_private.reports as report
      where report.incident_id = request.record_id
    );
    get diagnostics affected_rows = row_count;
    deleted_rows := deleted_rows + affected_rows;

    delete from app_private.reports
    where incident_id = request.record_id;
    get diagnostics affected_rows = row_count;
    deleted_rows := deleted_rows + affected_rows;

    delete from app_private.incident_revisions
    where incident_id = request.record_id;
    get diagnostics affected_rows = row_count;
    deleted_rows := deleted_rows + affected_rows;

    delete from app_private.incidents
    where id = request.record_id
      and facility_id = request.facility_id;
    get diagnostics affected_rows = row_count;
    if affected_rows <> 1 then
      raise exception 'Incident package disappeared before deletion completed';
    end if;
    deleted_rows := deleted_rows + affected_rows;
  else
    delete from app_private.paperwork_revisions
    where paperwork_record_id = request.record_id;
    get diagnostics affected_rows = row_count;
    deleted_rows := deleted_rows + affected_rows;

    delete from app_private.paperwork_records
    where id = request.record_id
      and facility_id = request.facility_id;
    get diagnostics affected_rows = row_count;
    if affected_rows <> 1 then
      raise exception 'Paperwork record disappeared before deletion completed';
    end if;
    deleted_rows := deleted_rows + affected_rows;
  end if;

  update app_private.retention_deletion_requests
  set status = 'completed',
      database_rows_deleted = deleted_rows,
      completed_at = statement_timestamp()
  where id = request.id;

  insert into app_private.audit_events (
    facility_id, actor_auth_user_id, event_type, target_type, target_id, metadata
  ) values (
    request.facility_id,
    p_actor_auth_user_id,
    'retention.deletion.completed',
    'retention_deletion_request',
    request.id,
    jsonb_build_object(
      'record_type', request.record_type,
      'database_rows_deleted', deleted_rows,
      'artifacts_deleted', request.artifact_count
    )
  );

  return deleted_rows;
end;
$$;

comment on function app_private.complete_retention_deletion(uuid, uuid) is
  'Completes one backup-aware deletion only inside the same transaction that acquired legal-hold locks, verified Storage cleanup, and rechecked eligibility.';

revoke all on function app_private.complete_retention_deletion(uuid, uuid)
  from public, anon, authenticated, service_role;

create trigger retention_deletion_requests_reject_delete
before delete on app_private.retention_deletion_requests
for each row execute function app_private.reject_mutation();

alter table app_private.record_artifacts enable row level security;
alter table app_private.record_artifacts force row level security;
alter table app_private.retention_deletion_requests enable row level security;
alter table app_private.retention_deletion_requests force row level security;

revoke all on table app_private.record_artifacts,
  app_private.retention_deletion_requests
  from public, anon, authenticated, service_role;

commit;
