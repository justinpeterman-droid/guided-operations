begin;

create extension if not exists pgcrypto with schema extensions;
create extension if not exists vector with schema extensions;

create schema if not exists api;
comment on schema api is
  'Locked Data API boundary. Add only reviewed RPCs or views with explicit grants.';

create schema if not exists app_private;
comment on schema app_private is
  'Private Guided Operations data. This foundation grants no runtime role access.';

revoke all on schema api from public, anon, authenticated, service_role;
revoke all on schema app_private from public, anon, authenticated, service_role;

alter default privileges in schema api
  revoke all on tables from public, anon, authenticated, service_role;
alter default privileges in schema api
  revoke all on sequences from public, anon, authenticated, service_role;
alter default privileges in schema api
  revoke all on functions from public, anon, authenticated, service_role;

alter default privileges in schema app_private
  revoke all on tables from public, anon, authenticated, service_role;
alter default privileges in schema app_private
  revoke all on sequences from public, anon, authenticated, service_role;
alter default privileges in schema app_private
  revoke all on functions from public, anon, authenticated, service_role;

create type app_private.staff_status as enum ('active', 'inactive');

create type app_private.account_role as enum ('officer', 'administrator');

create type app_private.account_status as enum (
  'pending',
  'active',
  'locked',
  'disabled'
);

create type app_private.policy_classification as enum (
  'public',
  'internal',
  'restricted'
);

create type app_private.policy_status as enum (
  'draft',
  'approved',
  'superseded',
  'retired'
);

create or replace function app_private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = statement_timestamp();
  return new;
end;
$$;

create or replace function app_private.reject_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Rows in %.% are append-only', tg_table_schema, tg_table_name;
end;
$$;

create table app_private.facilities (
  singleton_key smallint primary key default 1 check (singleton_key = 1),
  id uuid not null default gen_random_uuid() unique,
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  display_name text not null check (char_length(display_name) between 2 and 160),
  region_code text not null check (region_code ~ '^[a-z0-9-]{2,32}$'),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp()
);

comment on table app_private.facilities is
  'Single-facility configuration. The singleton constraint encodes the current product scope.';

create trigger facilities_touch_updated_at
before update on app_private.facilities
for each row execute function app_private.touch_updated_at();

create table app_private.staff_members (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references app_private.facilities(id) on delete restrict,
  employee_lookup_hash text not null unique
    check (employee_lookup_hash ~ '^[a-f0-9]{64}$'),
  employee_number_hint text not null
    check (char_length(employee_number_hint) between 2 and 8),
  display_name text not null check (char_length(display_name) between 1 and 160),
  status app_private.staff_status not null default 'active',
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp()
);

comment on column app_private.staff_members.employee_lookup_hash is
  'A keyed server-side lookup digest. Never store a raw employee number in logs or browser storage.';

create index staff_members_facility_status_idx
  on app_private.staff_members (facility_id, status, display_name);

create trigger staff_members_touch_updated_at
before update on app_private.staff_members
for each row execute function app_private.touch_updated_at();

create table app_private.user_accounts (
  auth_user_id uuid primary key references auth.users(id) on delete restrict,
  staff_member_id uuid not null unique
    references app_private.staff_members(id) on delete restrict,
  sign_in_alias text not null unique
    check (char_length(sign_in_alias) between 16 and 320),
  role app_private.account_role not null default 'officer',
  status app_private.account_status not null default 'pending',
  must_change_passcode boolean not null default true,
  failed_attempts integer not null default 0 check (failed_attempts >= 0),
  locked_until timestamptz,
  auth_version integer not null default 1 check (auth_version > 0),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  check (status = 'locked' or locked_until is null)
);

comment on table app_private.user_accounts is
  'Application authorization state linked to Supabase Auth. Authentication aliases are never shown in the UI.';

create index user_accounts_status_role_idx
  on app_private.user_accounts (status, role);

create trigger user_accounts_touch_updated_at
before update on app_private.user_accounts
for each row execute function app_private.touch_updated_at();

create table app_private.policy_documents (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references app_private.facilities(id) on delete restrict,
  stable_key text not null
    check (stable_key ~ '^[a-z0-9][a-z0-9_-]{1,127}$'),
  title text not null check (char_length(title) between 1 and 300),
  classification app_private.policy_classification not null default 'internal',
  status app_private.policy_status not null default 'draft',
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique (facility_id, stable_key)
);

create index policy_documents_facility_status_idx
  on app_private.policy_documents (facility_id, status, title);

create trigger policy_documents_touch_updated_at
before update on app_private.policy_documents
for each row execute function app_private.touch_updated_at();

create table app_private.policy_document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null
    references app_private.policy_documents(id) on delete restrict,
  version_label text not null check (char_length(version_label) between 1 and 120),
  source_sha256 text not null check (source_sha256 ~ '^[a-f0-9]{64}$'),
  storage_bucket text not null default 'policy-sources'
    check (storage_bucket = 'policy-sources'),
  storage_path text not null check (
    storage_path !~ '(^|/)\.\.(/|$)'
    and storage_path !~ '^/'
    and char_length(storage_path) between 1 and 1024
  ),
  media_type text not null check (media_type in ('application/pdf', 'text/plain')),
  page_count integer check (page_count is null or page_count > 0),
  effective_on date,
  approved_at timestamptz,
  indexed_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  unique (document_id, source_sha256),
  unique (storage_bucket, storage_path)
);

create index policy_document_versions_document_created_idx
  on app_private.policy_document_versions (document_id, created_at desc);

create table app_private.policy_chunks (
  id uuid primary key default gen_random_uuid(),
  document_version_id uuid not null
    references app_private.policy_document_versions(id) on delete cascade,
  ordinal integer not null check (ordinal >= 0),
  page_start integer check (page_start is null or page_start > 0),
  page_end integer check (page_end is null or page_end > 0),
  section_path text,
  content text not null check (char_length(content) between 1 and 20000),
  content_sha256 text not null check (content_sha256 ~ '^[a-f0-9]{64}$'),
  content_tsv tsvector generated always as (
    to_tsvector('english'::regconfig, content)
  ) stored,
  created_at timestamptz not null default statement_timestamp(),
  unique (document_version_id, ordinal),
  check ((page_start is null) = (page_end is null)),
  check (page_start is null or page_end >= page_start)
);

create index policy_chunks_document_version_idx
  on app_private.policy_chunks (document_version_id, ordinal);
create index policy_chunks_content_tsv_idx
  on app_private.policy_chunks using gin (content_tsv);

create table app_private.embedding_profiles (
  profile_key text primary key
    check (profile_key ~ '^[a-z0-9][a-z0-9._-]{1,127}$'),
  provider text not null check (char_length(provider) between 1 and 64),
  model text not null check (char_length(model) between 1 and 160),
  dimensions integer not null check (dimensions between 1 and 16000),
  enabled boolean not null default false,
  created_at timestamptz not null default statement_timestamp(),
  unique (provider, model, dimensions)
);

create or replace function app_private.protect_embedding_profile_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.profile_key is distinct from old.profile_key
    or new.provider is distinct from old.provider
    or new.model is distinct from old.model
    or new.dimensions is distinct from old.dimensions then
    raise exception 'Embedding profile identity is immutable; create a new profile instead';
  end if;

  return new;
end;
$$;

create trigger embedding_profiles_protect_identity
before update of profile_key, provider, model, dimensions
on app_private.embedding_profiles
for each row execute function app_private.protect_embedding_profile_identity();

create table app_private.policy_chunk_embeddings (
  policy_chunk_id uuid not null
    references app_private.policy_chunks(id) on delete cascade,
  profile_key text not null
    references app_private.embedding_profiles(profile_key) on delete restrict,
  embedding extensions.vector not null,
  created_at timestamptz not null default statement_timestamp(),
  primary key (policy_chunk_id, profile_key)
);

create or replace function app_private.validate_embedding_dimensions()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  expected_dimensions integer;
begin
  select profile.dimensions
    into strict expected_dimensions
    from app_private.embedding_profiles as profile
    where profile.profile_key = new.profile_key;

  if extensions.vector_dims(new.embedding) <> expected_dimensions then
    raise exception 'Embedding dimensions do not match profile %', new.profile_key;
  end if;

  return new;
end;
$$;

create trigger policy_chunk_embeddings_validate_dimensions
before insert or update on app_private.policy_chunk_embeddings
for each row execute function app_private.validate_embedding_dimensions();

create index policy_chunk_embeddings_profile_idx
  on app_private.policy_chunk_embeddings (profile_key, policy_chunk_id);

create table app_private.audit_events (
  id bigint generated always as identity primary key,
  event_id uuid not null default gen_random_uuid() unique,
  facility_id uuid not null references app_private.facilities(id) on delete restrict,
  actor_auth_user_id uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type ~ '^[a-z][a-z0-9_.-]{2,127}$'),
  target_type text check (
    target_type is null or target_type ~ '^[a-z][a-z0-9_.-]{1,63}$'
  ),
  target_id uuid,
  request_id uuid,
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  occurred_at timestamptz not null default statement_timestamp(),
  check ((target_type is null) = (target_id is null))
);

comment on table app_private.audit_events is
  'Append-only metadata audit log. Narrative content, policy text, PINs, tokens, and raw employee numbers are forbidden.';

create index audit_events_facility_occurred_idx
  on app_private.audit_events (facility_id, occurred_at desc, id desc);
create index audit_events_actor_occurred_idx
  on app_private.audit_events (actor_auth_user_id, occurred_at desc)
  where actor_auth_user_id is not null;

create trigger audit_events_immutable
before update or delete on app_private.audit_events
for each row execute function app_private.reject_mutation();

alter table app_private.facilities enable row level security;
alter table app_private.facilities force row level security;
alter table app_private.staff_members enable row level security;
alter table app_private.staff_members force row level security;
alter table app_private.user_accounts enable row level security;
alter table app_private.user_accounts force row level security;
alter table app_private.policy_documents enable row level security;
alter table app_private.policy_documents force row level security;
alter table app_private.policy_document_versions enable row level security;
alter table app_private.policy_document_versions force row level security;
alter table app_private.policy_chunks enable row level security;
alter table app_private.policy_chunks force row level security;
alter table app_private.embedding_profiles enable row level security;
alter table app_private.embedding_profiles force row level security;
alter table app_private.policy_chunk_embeddings enable row level security;
alter table app_private.policy_chunk_embeddings force row level security;
alter table app_private.audit_events enable row level security;
alter table app_private.audit_events force row level security;

revoke all on all tables in schema app_private
  from public, anon, authenticated, service_role;
revoke all on all sequences in schema app_private
  from public, anon, authenticated, service_role;
revoke all on all functions in schema app_private
  from public, anon, authenticated, service_role;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values
  (
    'policy-sources',
    'policy-sources',
    false,
    52428800,
    array['application/pdf', 'text/plain']::text[]
  ),
  (
    'generated-exports',
    'generated-exports',
    false,
    52428800,
    array[
      'application/pdf',
      'application/zip',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]::text[]
  )
on conflict (id) do update
set name = excluded.name,
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

commit;
