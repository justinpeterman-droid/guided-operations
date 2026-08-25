create table app_private.incidents (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references app_private.facilities(id) on delete restrict,
  created_by_account_id uuid not null
    references app_private.user_accounts(auth_user_id) on delete restrict,
  incident_number text not null check (char_length(incident_number) between 1 and 80),
  display_name text not null check (char_length(display_name) between 1 and 160),
  status text not null default 'draft'
    check (status in ('draft', 'in_review', 'complete', 'archived')),
  occurred_at timestamptz not null,
  category text not null check (char_length(category) between 1 and 100),
  current_revision_number integer not null default 0 check (current_revision_number >= 0),
  archived_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique (facility_id, incident_number),
  check ((status = 'archived') = (archived_at is not null))
);

create index incidents_creator_updated_idx
  on app_private.incidents (created_by_account_id, updated_at desc, id desc)
  where archived_at is null;

create trigger incidents_touch_updated_at
before update on app_private.incidents
for each row execute function app_private.touch_updated_at();

create table app_private.incident_revisions (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references app_private.incidents(id) on delete restrict,
  revision_number integer not null check (revision_number > 0),
  editor_account_id uuid not null
    references app_private.user_accounts(auth_user_id) on delete restrict,
  reason text check (reason is null or char_length(reason) between 1 and 500),
  schema_version integer not null check (schema_version > 0),
  field_notes jsonb not null check (jsonb_typeof(field_notes) = 'array'),
  reviewed_facts jsonb not null check (jsonb_typeof(reviewed_facts) = 'array'),
  gap_answers jsonb not null default '[]'::jsonb
    check (jsonb_typeof(gap_answers) = 'array'),
  validation jsonb not null default '{}'::jsonb
    check (jsonb_typeof(validation) = 'object'),
  warnings jsonb not null default '[]'::jsonb
    check (jsonb_typeof(warnings) = 'array'),
  provenance jsonb not null default '{}'::jsonb
    check (jsonb_typeof(provenance) = 'object'),
  created_at timestamptz not null default statement_timestamp(),
  unique (incident_id, revision_number)
);

create index incident_revisions_incident_created_idx
  on app_private.incident_revisions (incident_id, revision_number desc);

create trigger incident_revisions_immutable
before update or delete on app_private.incident_revisions
for each row execute function app_private.reject_mutation();

create table app_private.reports (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references app_private.incidents(id) on delete restrict,
  report_type text not null check (char_length(report_type) between 1 and 100),
  reporting_account_id uuid not null
    references app_private.user_accounts(auth_user_id) on delete restrict,
  prepared_by_account_id uuid not null
    references app_private.user_accounts(auth_user_id) on delete restrict,
  status text not null default 'draft'
    check (status in ('draft', 'in_review', 'complete', 'archived')),
  current_revision_number integer not null default 0 check (current_revision_number >= 0),
  archived_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique (incident_id, report_type, reporting_account_id),
  check ((status = 'archived') = (archived_at is not null))
);

create index reports_preparer_updated_idx
  on app_private.reports (prepared_by_account_id, updated_at desc, id desc)
  where archived_at is null;

create trigger reports_touch_updated_at
before update on app_private.reports
for each row execute function app_private.touch_updated_at();

create table app_private.report_access (
  report_id uuid not null references app_private.reports(id) on delete restrict,
  account_id uuid not null references app_private.user_accounts(auth_user_id) on delete restrict,
  relationship text not null
    check (relationship in ('owner', 'preparer', 'explicit_collaborator')),
  granted_by_account_id uuid not null
    references app_private.user_accounts(auth_user_id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  revoked_at timestamptz,
  primary key (report_id, account_id, relationship)
);

create unique index report_access_one_active_relationship_idx
  on app_private.report_access (report_id, account_id)
  where revoked_at is null;

create index report_access_account_report_idx
  on app_private.report_access (account_id, report_id)
  where revoked_at is null;

create table app_private.report_revisions (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references app_private.reports(id) on delete restrict,
  revision_number integer not null check (revision_number > 0),
  editor_account_id uuid not null
    references app_private.user_accounts(auth_user_id) on delete restrict,
  source_incident_revision_id uuid not null
    references app_private.incident_revisions(id) on delete restrict,
  reason text check (reason is null or char_length(reason) between 1 and 500),
  narrative text not null check (char_length(narrative) between 1 and 50000),
  schema_version integer not null check (schema_version > 0),
  validation jsonb not null default '{}'::jsonb
    check (jsonb_typeof(validation) = 'object'),
  warnings jsonb not null default '[]'::jsonb
    check (jsonb_typeof(warnings) = 'array'),
  provenance jsonb not null default '{}'::jsonb
    check (jsonb_typeof(provenance) = 'object'),
  created_at timestamptz not null default statement_timestamp(),
  unique (report_id, revision_number)
);

create index report_revisions_report_created_idx
  on app_private.report_revisions (report_id, revision_number desc);

create trigger report_revisions_immutable
before update or delete on app_private.report_revisions
for each row execute function app_private.reject_mutation();

alter table app_private.incidents enable row level security;
alter table app_private.incidents force row level security;
alter table app_private.incident_revisions enable row level security;
alter table app_private.incident_revisions force row level security;
alter table app_private.reports enable row level security;
alter table app_private.reports force row level security;
alter table app_private.report_access enable row level security;
alter table app_private.report_access force row level security;
alter table app_private.report_revisions enable row level security;
alter table app_private.report_revisions force row level security;

revoke all on table app_private.incidents,
  app_private.incident_revisions,
  app_private.reports,
  app_private.report_access,
  app_private.report_revisions
  from public, anon, authenticated, service_role;
