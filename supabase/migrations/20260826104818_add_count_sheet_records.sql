begin;

create table app_private.paperwork_records (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null
    references app_private.facilities(id) on delete restrict,
  kind text not null check (kind in ('count_sheet')),
  work_date date not null,
  shift_code text not null check (shift_code in ('A', 'B', 'C', 'D', 'U', 'F')),
  current_revision_number integer not null default 0
    check (current_revision_number >= 0),
  created_by_account_id uuid not null
    references app_private.user_accounts(auth_user_id) on delete restrict,
  archived_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp()
);

comment on table app_private.paperwork_records is
  'Canonical operational-paperwork head records. Count Sheets are unique per active facility, work date, and assigned shift.';

create unique index paperwork_records_active_shift_date_key
  on app_private.paperwork_records (facility_id, kind, work_date, shift_code)
  where archived_at is null;

create index paperwork_records_shift_date_updated_idx
  on app_private.paperwork_records (facility_id, shift_code, work_date desc, updated_at desc, id desc)
  where archived_at is null;

create trigger paperwork_records_touch_updated_at
before update on app_private.paperwork_records
for each row execute function app_private.touch_updated_at();

create table app_private.paperwork_revisions (
  id uuid primary key default gen_random_uuid(),
  paperwork_record_id uuid not null
    references app_private.paperwork_records(id) on delete restrict,
  revision_number integer not null check (revision_number > 0),
  editor_account_id uuid not null
    references app_private.user_accounts(auth_user_id) on delete restrict,
  reason text not null check (char_length(reason) between 1 and 500),
  structure jsonb not null check (jsonb_typeof(structure) = 'object'),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  validation jsonb not null check (jsonb_typeof(validation) = 'object'),
  provenance jsonb not null default '{}'::jsonb
    check (jsonb_typeof(provenance) = 'object'),
  created_at timestamptz not null default statement_timestamp(),
  unique (paperwork_record_id, revision_number)
);

comment on table app_private.paperwork_revisions is
  'Immutable Count Sheet snapshots. Structure, user-entered values, and server-calculated validation stay bound to one revision.';

create index paperwork_revisions_record_revision_idx
  on app_private.paperwork_revisions (paperwork_record_id, revision_number desc);

create trigger paperwork_revisions_immutable
before update or delete on app_private.paperwork_revisions
for each row execute function app_private.reject_mutation();

create or replace function app_private.enforce_paperwork_revision_sequence()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_head integer;
begin
  select record.current_revision_number
    into strict current_head
    from app_private.paperwork_records as record
    where record.id = new.paperwork_record_id
    for update;

  if new.revision_number <> current_head + 1 then
    raise exception 'Paperwork revision must advance exactly one revision from the current head';
  end if;

  return new;
end;
$$;

comment on function app_private.enforce_paperwork_revision_sequence() is
  'Private serialized guard that accepts only the next Count Sheet revision number.';

revoke all on function app_private.enforce_paperwork_revision_sequence()
  from public, anon, authenticated, service_role;

create trigger paperwork_revisions_enforce_sequence
before insert on app_private.paperwork_revisions
for each row execute function app_private.enforce_paperwork_revision_sequence();

create or replace function app_private.advance_paperwork_revision_head()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update app_private.paperwork_records as record
    set current_revision_number = new.revision_number,
        updated_at = statement_timestamp()
    where record.id = new.paperwork_record_id
      and record.current_revision_number = new.revision_number - 1;

  if not found then
    raise exception 'Paperwork revision head changed before it could be advanced';
  end if;

  return new;
end;
$$;

comment on function app_private.advance_paperwork_revision_head() is
  'Private trigger that advances a Count Sheet head only after its immutable revision is inserted.';

revoke all on function app_private.advance_paperwork_revision_head()
  from public, anon, authenticated, service_role;

create trigger paperwork_revisions_advance_head
after insert on app_private.paperwork_revisions
for each row execute function app_private.advance_paperwork_revision_head();

alter table app_private.paperwork_records enable row level security;
alter table app_private.paperwork_records force row level security;
alter table app_private.paperwork_revisions enable row level security;
alter table app_private.paperwork_revisions force row level security;

revoke all on table app_private.paperwork_records
  from public, anon, authenticated, service_role;
revoke all on table app_private.paperwork_revisions
  from public, anon, authenticated, service_role;

commit;
