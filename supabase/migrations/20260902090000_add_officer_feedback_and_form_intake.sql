begin;

-- Private, review-first product-improvement records. Content-bearing feedback
-- and form-source metadata remain outside the exposed Data API schema.
create table app_private.improvement_requests (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references app_private.facilities(id) on delete restrict,
  submitted_by_account_id uuid not null
    references app_private.user_accounts(auth_user_id) on delete restrict,
  request_nonce uuid not null,
  request_kind text not null check (
    request_kind in ('page_feedback', 'form_request', 'form_candidate')
  ),
  category text not null check (
    category in (
      'not_working', 'confusing', 'wording', 'missing', 'idea',
      'missing_form', 'outdated_form', 'fillable_form', 'form_problem'
    )
  ),
  status text not null default 'submitted' check (
    status in (
      'submitted', 'under_review', 'needs_information', 'planned',
      'ready_for_publication', 'completed', 'declined', 'withdrawn'
    )
  ),
  description text not null check (char_length(description) between 3 and 4000),
  route_path text check (
    route_path is null
    or (char_length(route_path) between 1 and 320 and route_path ~ '^/[A-Za-z0-9/_-]*$')
  ),
  target_id text check (
    target_id is null
    or (char_length(target_id) between 1 and 160 and target_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$')
  ),
  target_role text check (
    target_role is null
    or (char_length(target_role) between 1 and 64 and target_role ~ '^[A-Za-z][A-Za-z0-9_-]{0,63}$')
  ),
  target_label text check (
    target_label is null or char_length(target_label) between 1 and 240
  ),
  viewport_width integer check (viewport_width is null or viewport_width between 320 and 10000),
  viewport_height integer check (viewport_height is null or viewport_height between 320 and 10000),
  release_sha text check (release_sha is null or release_sha ~ '^[a-f0-9]{40}$'),
  form_title text check (form_title is null or char_length(form_title) between 2 and 200),
  source_authority text check (
    source_authority is null or char_length(source_authority) between 2 and 160
  ),
  source_revision text check (
    source_revision is null or char_length(source_revision) between 1 and 160
  ),
  requested_use text check (
    requested_use is null or requested_use in ('view_only', 'browser_fillable', 'workflow_connected')
  ),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  completed_at timestamptz,
  unique (submitted_by_account_id, request_nonce),
  constraint improvement_requests_kind_category_check check (
    (
      request_kind = 'page_feedback'
      and category in ('not_working', 'confusing', 'wording', 'missing', 'idea')
      and form_title is null
      and source_authority is null
      and source_revision is null
      and requested_use is null
    )
    or (
      request_kind in ('form_request', 'form_candidate')
      and category in ('missing_form', 'outdated_form', 'fillable_form', 'form_problem')
      and form_title is not null
      and requested_use is not null
      and target_id is null
      and target_role is null
    )
  ),
  constraint improvement_requests_completion_check check (
    (status = 'completed' and completed_at is not null)
    or (status <> 'completed' and completed_at is null)
  )
);

comment on table app_private.improvement_requests is
  'Private officer/admin product-improvement and blank-form intake requests. Descriptions are protected content and never general audit metadata.';

create index improvement_requests_submitter_updated_idx
  on app_private.improvement_requests (submitted_by_account_id, updated_at desc, id desc);
create index improvement_requests_facility_review_idx
  on app_private.improvement_requests (facility_id, status, updated_at desc, id desc);
create index improvement_requests_active_target_idx
  on app_private.improvement_requests (facility_id, route_path, target_id, updated_at desc)
  where request_kind = 'page_feedback' and status not in ('completed', 'declined', 'withdrawn');

create trigger improvement_requests_touch_updated_at
before update on app_private.improvement_requests
for each row execute function app_private.touch_updated_at();

create table app_private.improvement_request_messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references app_private.improvement_requests(id) on delete restrict,
  facility_id uuid not null references app_private.facilities(id) on delete restrict,
  author_account_id uuid not null
    references app_private.user_accounts(auth_user_id) on delete restrict,
  body text not null check (char_length(body) between 1 and 3000),
  created_at timestamptz not null default statement_timestamp()
);

comment on table app_private.improvement_request_messages is
  'Append-only private follow-up messages for an improvement request. Message bodies do not enter audit telemetry.';

create index improvement_request_messages_request_created_idx
  on app_private.improvement_request_messages (request_id, created_at asc, id asc);

create trigger improvement_request_messages_immutable
before update or delete on app_private.improvement_request_messages
for each row execute function app_private.reject_mutation();

create table app_private.improvement_request_status_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references app_private.improvement_requests(id) on delete restrict,
  facility_id uuid not null references app_private.facilities(id) on delete restrict,
  changed_by_account_id uuid not null
    references app_private.user_accounts(auth_user_id) on delete restrict,
  previous_status text,
  next_status text not null check (
    next_status in (
      'submitted', 'under_review', 'needs_information', 'planned',
      'ready_for_publication', 'completed', 'declined', 'withdrawn'
    )
  ),
  reason_code text not null check (
    reason_code in (
      'submitted', 'review_started', 'follow_up_needed', 'planned',
      'form_ready_for_publication', 'resolved', 'declined', 'withdrawn'
    )
  ),
  created_at timestamptz not null default statement_timestamp(),
  check (previous_status is null or previous_status in (
    'submitted', 'under_review', 'needs_information', 'planned',
    'ready_for_publication', 'completed', 'declined', 'withdrawn'
  ))
);

comment on table app_private.improvement_request_status_events is
  'Append-only current-status provenance for private improvement requests.';

create index improvement_request_status_events_request_created_idx
  on app_private.improvement_request_status_events (request_id, created_at asc, id asc);

create trigger improvement_request_status_events_immutable
before update or delete on app_private.improvement_request_status_events
for each row execute function app_private.reject_mutation();

create table app_private.form_candidate_files (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique
    references app_private.improvement_requests(id) on delete restrict,
  facility_id uuid not null references app_private.facilities(id) on delete restrict,
  uploaded_by_account_id uuid not null
    references app_private.user_accounts(auth_user_id) on delete restrict,
  storage_bucket text not null default 'form-candidate-quarantine'
    check (storage_bucket = 'form-candidate-quarantine'),
  storage_path text not null unique check (
    char_length(storage_path) between 40 and 240
    and storage_path !~ '(^|/)\\.\\.(/|$)'
    and storage_path !~ '^/'
  ),
  original_filename text not null check (
    char_length(original_filename) between 1 and 160
    and original_filename !~ '[\\x00/\\\\]'
  ),
  declared_media_type text not null check (declared_media_type in (
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png'
  )),
  declared_byte_size bigint not null check (declared_byte_size between 1 and 10485760),
  declared_sha256 text not null check (declared_sha256 ~ '^[a-f0-9]{64}$'),
  actual_byte_size bigint,
  actual_sha256 text,
  actual_media_type text,
  upload_state text not null default 'uploading' check (
    upload_state in ('uploading', 'uploaded', 'rejected', 'expired')
  ),
  uploaded_at timestamptz,
  rejected_at timestamptz,
  expires_at timestamptz not null default statement_timestamp() + interval '7 days',
  created_at timestamptz not null default statement_timestamp(),
  check ((upload_state = 'uploaded') = (
    actual_byte_size is not null
    and actual_sha256 is not null
    and actual_media_type is not null
    and uploaded_at is not null
  )),
  check ((upload_state = 'rejected') = (rejected_at is not null))
);

comment on table app_private.form_candidate_files is
  'Private request-bound quarantine object metadata for one blank form candidate. The object is not an approved library template.';

create index form_candidate_files_review_idx
  on app_private.form_candidate_files (facility_id, upload_state, expires_at asc, id asc);

alter table app_private.improvement_requests enable row level security;
alter table app_private.improvement_requests force row level security;
alter table app_private.improvement_request_messages enable row level security;
alter table app_private.improvement_request_messages force row level security;
alter table app_private.improvement_request_status_events enable row level security;
alter table app_private.improvement_request_status_events force row level security;
alter table app_private.form_candidate_files enable row level security;
alter table app_private.form_candidate_files force row level security;

revoke all on table app_private.improvement_requests,
  app_private.improvement_request_messages,
  app_private.improvement_request_status_events,
  app_private.form_candidate_files
  from public, anon, authenticated, service_role;

-- Every current product table must participate in the protected backup freeze.
do $$
declare
  table_name text;
  trigger_name text;
begin
  foreach table_name in array array[
    'improvement_requests',
    'improvement_request_messages',
    'improvement_request_status_events',
    'form_candidate_files'
  ]
  loop
    trigger_name := 'guided_operations_backup_freeze_' ||
      substr(md5('app_private.' || table_name), 1, 16);
    execute format(
      'create trigger %I before insert or update or delete or truncate on app_private.%I for each statement execute function app_private.require_no_production_backup_write_freeze()',
      trigger_name,
      table_name
    );
  end loop;
end;
$$;

create or replace function api.create_improvement_request(
  p_request_nonce uuid,
  p_request_kind text,
  p_category text,
  p_description text,
  p_route_path text,
  p_target_id text,
  p_target_role text,
  p_target_label text,
  p_viewport_width integer,
  p_viewport_height integer,
  p_form_title text,
  p_source_authority text,
  p_source_revision text,
  p_requested_use text,
  p_file_name text,
  p_file_media_type text,
  p_file_byte_size bigint,
  p_file_sha256 text
)
returns table (request_id uuid, upload_path text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_account_id uuid := auth.uid();
  v_facility_id uuid := app_private.current_active_facility_id();
  v_existing_request_id uuid;
  v_request_id uuid;
  v_upload_path text;
  v_file_requested boolean := p_file_name is not null
    or p_file_media_type is not null
    or p_file_byte_size is not null
    or p_file_sha256 is not null;
begin
  if v_actor_account_id is null or v_facility_id is null or p_request_nonce is null then
    raise exception using errcode = '42501', message = 'Not authorized to submit an improvement request';
  end if;

  if p_request_kind not in ('page_feedback', 'form_request', 'form_candidate')
    or p_category not in (
      'not_working', 'confusing', 'wording', 'missing', 'idea',
      'missing_form', 'outdated_form', 'fillable_form', 'form_problem'
    )
    or p_description is null
    or char_length(btrim(p_description)) not between 3 and 4000 then
    raise exception using errcode = '22023', message = 'Invalid improvement request';
  end if;

  if p_request_kind = 'page_feedback' then
    if p_category not in ('not_working', 'confusing', 'wording', 'missing', 'idea')
      or p_form_title is not null
      or p_source_authority is not null
      or p_source_revision is not null
      or p_requested_use is not null
      or v_file_requested then
      raise exception using errcode = '22023', message = 'Invalid page feedback request';
    end if;
  elsif p_category not in ('missing_form', 'outdated_form', 'fillable_form', 'form_problem')
    or p_form_title is null
    or char_length(btrim(p_form_title)) not between 2 and 200
    or p_requested_use not in ('view_only', 'browser_fillable', 'workflow_connected')
    or p_target_id is not null
    or p_target_role is not null then
    raise exception using errcode = '22023', message = 'Invalid form request';
  end if;

  if p_request_kind = 'form_candidate' and not v_file_requested then
    raise exception using errcode = '22023', message = 'A form candidate requires one file';
  end if;
  if p_request_kind = 'form_request' and v_file_requested then
    raise exception using errcode = '22023', message = 'Use a form candidate request to upload a file';
  end if;
  if v_file_requested and (
    p_file_name is null
    or p_file_name !~ '^[^/\\\\[:cntrl:]]{1,160}$'
    or p_file_media_type not in (
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg',
      'image/png'
    )
    or p_file_byte_size not between 1 and 10485760
    or p_file_sha256 !~ '^[a-f0-9]{64}$'
  ) then
    raise exception using errcode = '22023', message = 'Invalid form candidate file';
  end if;

  select request.id into v_existing_request_id
  from app_private.improvement_requests as request
  where request.submitted_by_account_id = v_actor_account_id
    and request.request_nonce = p_request_nonce;
  if found then
    return query
      select request.id, file.storage_path
      from app_private.improvement_requests as request
      left join app_private.form_candidate_files as file on file.request_id = request.id
      where request.id = v_existing_request_id;
    return;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(v_actor_account_id::text)
  );
  if (
    select count(*)
    from app_private.improvement_requests as request
    where request.submitted_by_account_id = v_actor_account_id
      and request.created_at >= statement_timestamp() - interval '1 hour'
  ) >= 30 then
    raise exception using errcode = '54000', message = 'Improvement request limit reached';
  end if;

  insert into app_private.improvement_requests (
    facility_id, submitted_by_account_id, request_nonce, request_kind, category,
    description, route_path, target_id, target_role, target_label,
    viewport_width, viewport_height, form_title, source_authority,
    source_revision, requested_use
  ) values (
    v_facility_id, v_actor_account_id, p_request_nonce, p_request_kind, p_category,
    btrim(p_description), nullif(p_route_path, ''), nullif(p_target_id, ''),
    nullif(p_target_role, ''), nullif(p_target_label, ''), p_viewport_width,
    p_viewport_height, nullif(btrim(p_form_title), ''),
    nullif(btrim(p_source_authority), ''), nullif(btrim(p_source_revision), ''),
    nullif(p_requested_use, '')
  ) returning id into v_request_id;

  insert into app_private.improvement_request_status_events (
    request_id, facility_id, changed_by_account_id, previous_status, next_status, reason_code
  ) values (
    v_request_id, v_facility_id, v_actor_account_id, null, 'submitted', 'submitted'
  );

  if v_file_requested then
    v_upload_path := v_actor_account_id::text || '/' || v_request_id::text || '/source';
    insert into app_private.form_candidate_files (
      request_id, facility_id, uploaded_by_account_id, storage_path,
      original_filename, declared_media_type, declared_byte_size, declared_sha256
    ) values (
      v_request_id, v_facility_id, v_actor_account_id, v_upload_path,
      p_file_name, p_file_media_type, p_file_byte_size, p_file_sha256
    );
  end if;

  return query select v_request_id, v_upload_path;
end;
$$;

comment on function api.create_improvement_request(
  uuid, text, text, text, text, text, text, text, integer, integer,
  text, text, text, text, text, text, bigint, text
) is
  'Creates an active-account private feedback or form request with an optional request-bound quarantine upload intent.';

revoke all on function api.create_improvement_request(
  uuid, text, text, text, text, text, text, text, integer, integer,
  text, text, text, text, text, text, bigint, text
) from public, anon, service_role;
grant execute on function api.create_improvement_request(
  uuid, text, text, text, text, text, text, text, integer, integer,
  text, text, text, text, text, text, bigint, text
) to authenticated;

create or replace function api.form_candidate_upload_object_is_writable(
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
    from app_private.form_candidate_files as file
    join app_private.improvement_requests as request on request.id = file.request_id
    join app_private.user_accounts as account
      on account.auth_user_id = file.uploaded_by_account_id
    join app_private.staff_members as staff on staff.id = account.staff_member_id
    where p_object_name is not null
      and file.storage_bucket = 'form-candidate-quarantine'
      and file.storage_path = p_object_name
      and file.uploaded_by_account_id = auth.uid()
      and request.submitted_by_account_id = auth.uid()
      and request.facility_id = staff.facility_id
      and account.status = 'active'
      and not account.must_change_passcode
      and staff.status = 'active'
      and file.upload_state = 'uploading'
      and file.expires_at > statement_timestamp()
  );
$$;

comment on function api.form_candidate_upload_object_is_writable(text) is
  'Allows an active owner to create exactly one request-bound quarantine object; it does not allow browsing or replacement.';

revoke all on function api.form_candidate_upload_object_is_writable(text)
  from public, anon, service_role;
grant execute on function api.form_candidate_upload_object_is_writable(text)
  to authenticated;

create or replace function api.form_candidate_object_is_readable(
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
    from app_private.form_candidate_files as file
    join app_private.improvement_requests as request on request.id = file.request_id
    join app_private.user_accounts as actor on actor.auth_user_id = auth.uid()
    join app_private.staff_members as actor_staff on actor_staff.id = actor.staff_member_id
    where p_object_name is not null
      and file.storage_bucket = 'form-candidate-quarantine'
      and file.storage_path = p_object_name
      and file.expires_at > statement_timestamp()
      and actor.status = 'active'
      and not actor.must_change_passcode
      and actor_staff.status = 'active'
      and actor_staff.facility_id = request.facility_id
      and (
        (
          file.uploaded_by_account_id = auth.uid()
          and file.upload_state in ('uploading', 'uploaded')
        )
        or (
          actor.role = 'administrator'
          and file.upload_state = 'uploaded'
        )
      )
  );
$$;

comment on function api.form_candidate_object_is_readable(text) is
  'Allows the active upload owner or same-facility active administrator to read one finalized quarantine object through the server.';

revoke all on function api.form_candidate_object_is_readable(text)
  from public, anon, service_role;
grant execute on function api.form_candidate_object_is_readable(text)
  to authenticated;

insert into storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
) values (
  'form-candidate-quarantine',
  'form-candidate-quarantine',
  false,
  10485760,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png'
  ]::text[]
) on conflict (id) do update
set name = excluded.name,
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists form_candidate_quarantine_owner_insert on storage.objects;
create policy form_candidate_quarantine_owner_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'form-candidate-quarantine'
  and api.form_candidate_upload_object_is_writable(name)
);

drop policy if exists form_candidate_quarantine_authorized_read on storage.objects;
create policy form_candidate_quarantine_authorized_read
on storage.objects
for select
to authenticated
using (
  bucket_id = 'form-candidate-quarantine'
  and api.form_candidate_object_is_readable(name)
);

-- Finalization is intentionally server-only: the route hashes and validates
-- the downloaded object before invoking this private routine.
create or replace function app_private.finalize_form_candidate_upload(
  p_request_id uuid,
  p_actor_account_id uuid,
  p_actual_byte_size bigint,
  p_actual_sha256 text,
  p_actual_media_type text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_file app_private.form_candidate_files%rowtype;
  v_request app_private.improvement_requests%rowtype;
begin
  if p_request_id is null
    or p_actor_account_id is null
    or p_actual_byte_size not between 1 and 10485760
    or p_actual_sha256 !~ '^[a-f0-9]{64}$'
    or p_actual_media_type not in (
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg',
      'image/png'
    ) then
    raise exception using errcode = '22023', message = 'Invalid form candidate finalization';
  end if;

  select * into strict v_file
  from app_private.form_candidate_files as file
  where file.request_id = p_request_id
  for update;
  select * into strict v_request
  from app_private.improvement_requests as request
  where request.id = p_request_id
  for update;

  if v_file.uploaded_by_account_id <> p_actor_account_id
    or v_request.submitted_by_account_id <> p_actor_account_id
    or v_file.upload_state <> 'uploading'
    or v_file.expires_at <= statement_timestamp()
    or v_file.declared_byte_size <> p_actual_byte_size
    or v_file.declared_sha256 <> p_actual_sha256
    or v_file.declared_media_type <> p_actual_media_type
    or not exists (
      select 1
      from storage.objects as object
      where object.bucket_id = v_file.storage_bucket
        and object.name = v_file.storage_path
    ) then
    raise exception using errcode = '22023', message = 'Form candidate object does not match its upload intent';
  end if;

  update app_private.form_candidate_files
  set actual_byte_size = p_actual_byte_size,
      actual_sha256 = p_actual_sha256,
      actual_media_type = p_actual_media_type,
      upload_state = 'uploaded',
      uploaded_at = statement_timestamp()
  where id = v_file.id;

  return true;
end;
$$;

revoke all on function app_private.finalize_form_candidate_upload(
  uuid, uuid, bigint, text, text
) from public, anon, authenticated, service_role;

create or replace function app_private.set_improvement_request_release_sha(
  p_request_id uuid,
  p_actor_account_id uuid,
  p_release_sha text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_request_id is null
    or p_actor_account_id is null
    or p_release_sha is null
    or p_release_sha !~ '^[a-f0-9]{40}$' then
    return false;
  end if;
  update app_private.improvement_requests
  set release_sha = p_release_sha,
      updated_at = statement_timestamp()
  where id = p_request_id
    and submitted_by_account_id = p_actor_account_id;
  return found;
end;
$$;

revoke all on function app_private.set_improvement_request_release_sha(uuid, uuid, text)
  from public, anon, authenticated, service_role;

create or replace function api.list_my_improvement_requests(
  p_limit integer default 50
)
returns table (
  request_id uuid,
  request_kind text,
  category text,
  status text,
  route_path text,
  target_label text,
  form_title text,
  requested_use text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    request.id,
    request.request_kind,
    request.category,
    request.status,
    request.route_path,
    request.target_label,
    request.form_title,
    request.requested_use,
    request.created_at,
    request.updated_at
  from app_private.improvement_requests as request
  where request.submitted_by_account_id = auth.uid()
    and app_private.current_active_facility_id() = request.facility_id
  order by request.updated_at desc, request.id desc
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
$$;

revoke all on function api.list_my_improvement_requests(integer)
  from public, anon, service_role;
grant execute on function api.list_my_improvement_requests(integer)
  to authenticated;

create or replace function api.list_admin_improvement_requests(
  p_limit integer default 100,
  p_status text default null
)
returns table (
  request_id uuid,
  request_kind text,
  category text,
  status text,
  description text,
  route_path text,
  target_id text,
  target_role text,
  target_label text,
  viewport_width integer,
  viewport_height integer,
  release_sha text,
  form_title text,
  source_authority text,
  source_revision text,
  requested_use text,
  submitted_by_display_name text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_facility_id uuid := app_private.current_active_facility_id();
begin
  if v_facility_id is null or not exists (
    select 1
    from app_private.user_accounts as account
    join app_private.staff_members as staff on staff.id = account.staff_member_id
    where account.auth_user_id = auth.uid()
      and account.role = 'administrator'
      and account.status = 'active'
      and not account.must_change_passcode
      and staff.status = 'active'
      and staff.facility_id = v_facility_id
  ) then
    return;
  end if;

  if p_status is not null and p_status not in (
    'submitted', 'under_review', 'needs_information', 'planned',
    'ready_for_publication', 'completed', 'declined', 'withdrawn'
  ) then
    raise exception using errcode = '22023', message = 'Invalid improvement request status';
  end if;

  return query
    select
      request.id,
      request.request_kind,
      request.category,
      request.status,
      request.description,
      request.route_path,
      request.target_id,
      request.target_role,
      request.target_label,
      request.viewport_width,
      request.viewport_height,
      request.release_sha,
      request.form_title,
      request.source_authority,
      request.source_revision,
      request.requested_use,
      submitter.display_name,
      request.created_at,
      request.updated_at
    from app_private.improvement_requests as request
    join app_private.user_accounts as submitter_account
      on submitter_account.auth_user_id = request.submitted_by_account_id
    join app_private.staff_members as submitter
      on submitter.id = submitter_account.staff_member_id
    where request.facility_id = v_facility_id
      and (p_status is null or request.status = p_status)
    order by request.updated_at desc, request.id desc
    limit least(greatest(coalesce(p_limit, 100), 1), 200);
end;
$$;

revoke all on function api.list_admin_improvement_requests(integer, text)
  from public, anon, service_role;
grant execute on function api.list_admin_improvement_requests(integer, text)
  to authenticated;

create or replace function api.add_improvement_request_message(
  p_request_id uuid,
  p_body text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_account_id uuid := auth.uid();
  v_facility_id uuid := app_private.current_active_facility_id();
  v_request app_private.improvement_requests%rowtype;
  v_is_admin boolean;
  v_message_id uuid;
begin
  if v_actor_account_id is null or v_facility_id is null
    or p_request_id is null or p_body is null
    or char_length(btrim(p_body)) not between 1 and 3000 then
    raise exception using errcode = '22023', message = 'Invalid improvement request message';
  end if;

  select * into strict v_request
  from app_private.improvement_requests as request
  where request.id = p_request_id
  for update;
  v_is_admin := exists (
    select 1
    from app_private.user_accounts as account
    join app_private.staff_members as staff on staff.id = account.staff_member_id
    where account.auth_user_id = v_actor_account_id
      and account.role = 'administrator'
      and account.status = 'active'
      and not account.must_change_passcode
      and staff.status = 'active'
      and staff.facility_id = v_facility_id
  );

  if v_request.facility_id <> v_facility_id
    or (v_request.submitted_by_account_id <> v_actor_account_id and not v_is_admin) then
    raise exception using errcode = '42501', message = 'Not authorized to message this improvement request';
  end if;

  insert into app_private.improvement_request_messages (
    request_id, facility_id, author_account_id, body
  ) values (
    v_request.id, v_facility_id, v_actor_account_id, btrim(p_body)
  ) returning id into v_message_id;

  update app_private.improvement_requests
  set updated_at = statement_timestamp()
  where id = v_request.id;

  return v_message_id;
end;
$$;

revoke all on function api.add_improvement_request_message(uuid, text)
  from public, anon, service_role;
grant execute on function api.add_improvement_request_message(uuid, text)
  to authenticated;

create or replace function api.transition_improvement_request(
  p_request_id uuid,
  p_next_status text,
  p_reason_code text,
  p_follow_up_message text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_account_id uuid := auth.uid();
  v_facility_id uuid := app_private.current_active_facility_id();
  v_request app_private.improvement_requests%rowtype;
begin
  if v_actor_account_id is null or v_facility_id is null
    or p_request_id is null
    or p_next_status not in (
      'under_review', 'needs_information', 'planned',
      'ready_for_publication', 'completed', 'declined'
    )
    or p_reason_code not in (
      'review_started', 'follow_up_needed', 'planned',
      'form_ready_for_publication', 'resolved', 'declined'
    )
    or (p_follow_up_message is not null and char_length(btrim(p_follow_up_message)) not between 1 and 3000) then
    raise exception using errcode = '22023', message = 'Invalid improvement request transition';
  end if;

  if not exists (
    select 1
    from app_private.user_accounts as account
    join app_private.staff_members as staff on staff.id = account.staff_member_id
    where account.auth_user_id = v_actor_account_id
      and account.role = 'administrator'
      and account.status = 'active'
      and not account.must_change_passcode
      and staff.status = 'active'
      and staff.facility_id = v_facility_id
  ) then
    raise exception using errcode = '42501', message = 'Not authorized to review improvement requests';
  end if;

  select * into strict v_request
  from app_private.improvement_requests as request
  where request.id = p_request_id
  for update;
  if v_request.facility_id <> v_facility_id
    or v_request.status in ('completed', 'declined', 'withdrawn') then
    raise exception using errcode = '42501', message = 'Improvement request cannot be transitioned';
  end if;
  if p_next_status = 'ready_for_publication' and v_request.request_kind <> 'form_candidate' then
    raise exception using errcode = '22023', message = 'Only a form candidate can be ready for publication';
  end if;
  if (p_next_status, p_reason_code) not in (
    ('under_review', 'review_started'),
    ('needs_information', 'follow_up_needed'),
    ('planned', 'planned'),
    ('ready_for_publication', 'form_ready_for_publication'),
    ('completed', 'resolved'),
    ('declined', 'declined')
  ) then
    raise exception using errcode = '22023', message = 'Improvement request transition reason does not match';
  end if;

  update app_private.improvement_requests
  set status = p_next_status,
      completed_at = case when p_next_status = 'completed' then statement_timestamp() else null end,
      updated_at = statement_timestamp()
  where id = v_request.id;

  insert into app_private.improvement_request_status_events (
    request_id, facility_id, changed_by_account_id, previous_status, next_status, reason_code
  ) values (
    v_request.id, v_facility_id, v_actor_account_id, v_request.status,
    p_next_status, p_reason_code
  );

  if p_follow_up_message is not null then
    insert into app_private.improvement_request_messages (
      request_id, facility_id, author_account_id, body
    ) values (
      v_request.id, v_facility_id, v_actor_account_id, btrim(p_follow_up_message)
    );
  end if;

  return true;
end;
$$;

revoke all on function api.transition_improvement_request(uuid, text, text, text)
  from public, anon, service_role;
grant execute on function api.transition_improvement_request(uuid, text, text, text)
  to authenticated;

create or replace function api.get_improvement_request(
  p_request_id uuid
)
returns table (
  request_id uuid,
  request_kind text,
  category text,
  status text,
  description text,
  route_path text,
  target_id text,
  target_role text,
  target_label text,
  viewport_width integer,
  viewport_height integer,
  release_sha text,
  form_title text,
  source_authority text,
  source_revision text,
  requested_use text,
  file_uploaded boolean,
  file_name text,
  file_media_type text,
  file_byte_size bigint,
  submitted_by_display_name text,
  created_at timestamptz,
  updated_at timestamptz,
  messages jsonb,
  status_history jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor_account_id uuid := auth.uid();
  v_facility_id uuid := app_private.current_active_facility_id();
  v_is_admin boolean;
begin
  if p_request_id is null or v_actor_account_id is null or v_facility_id is null then
    return;
  end if;

  v_is_admin := exists (
    select 1
    from app_private.user_accounts as account
    join app_private.staff_members as staff on staff.id = account.staff_member_id
    where account.auth_user_id = v_actor_account_id
      and account.role = 'administrator'
      and account.status = 'active'
      and not account.must_change_passcode
      and staff.status = 'active'
      and staff.facility_id = v_facility_id
  );

  return query
    select
      request.id,
      request.request_kind,
      request.category,
      request.status,
      request.description,
      request.route_path,
      request.target_id,
      request.target_role,
      request.target_label,
      request.viewport_width,
      request.viewport_height,
      request.release_sha,
      request.form_title,
      request.source_authority,
      request.source_revision,
      request.requested_use,
      file.upload_state = 'uploaded',
      file.original_filename,
      file.actual_media_type,
      file.actual_byte_size,
      submitter.display_name,
      request.created_at,
      request.updated_at,
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', message.id,
          'body', message.body,
          'author_is_administrator', author.role = 'administrator',
          'created_at', message.created_at
        ) order by message.created_at asc, message.id asc)
        from app_private.improvement_request_messages as message
        join app_private.user_accounts as author
          on author.auth_user_id = message.author_account_id
        where message.request_id = request.id
      ), '[]'::jsonb),
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'previous_status', event.previous_status,
          'next_status', event.next_status,
          'reason_code', event.reason_code,
          'changed_at', event.created_at
        ) order by event.created_at asc, event.id asc)
        from app_private.improvement_request_status_events as event
        where event.request_id = request.id
      ), '[]'::jsonb)
    from app_private.improvement_requests as request
    join app_private.user_accounts as submitter_account
      on submitter_account.auth_user_id = request.submitted_by_account_id
    join app_private.staff_members as submitter
      on submitter.id = submitter_account.staff_member_id
    left join app_private.form_candidate_files as file on file.request_id = request.id
    where request.id = p_request_id
      and request.facility_id = v_facility_id
      and (request.submitted_by_account_id = v_actor_account_id or v_is_admin);
end;
$$;

revoke all on function api.get_improvement_request(uuid)
  from public, anon, service_role;
grant execute on function api.get_improvement_request(uuid)
  to authenticated;

commit;
