begin;

alter table app_private.incidents
  add column deletion_eligible_at timestamptz
  generated always as (
    ((archived_at at time zone 'UTC') + interval '730 days') at time zone 'UTC'
  ) stored;

alter table app_private.reports
  add column deletion_eligible_at timestamptz
  generated always as (
    ((archived_at at time zone 'UTC') + interval '730 days') at time zone 'UTC'
  ) stored;

alter table app_private.paperwork_records
  add column deletion_eligible_at timestamptz
  generated always as (
    ((archived_at at time zone 'UTC') + interval '730 days') at time zone 'UTC'
  ) stored;

comment on column app_private.incidents.deletion_eligible_at is
  'Earliest ordinary deletion-review time. Archival occurs at or after the final revision; active legal holds and approval gates still override this date.';
comment on column app_private.reports.deletion_eligible_at is
  'Earliest ordinary deletion-review time. Archival occurs at or after the final revision; active legal holds and approval gates still override this date.';
comment on column app_private.paperwork_records.deletion_eligible_at is
  'Earliest ordinary deletion-review time. Archival occurs at or after the final revision; active legal holds and approval gates still override this date.';

create index incidents_deletion_eligibility_idx
  on app_private.incidents (deletion_eligible_at, facility_id, id)
  where deletion_eligible_at is not null;
create index reports_deletion_eligibility_idx
  on app_private.reports (deletion_eligible_at, incident_id, id)
  where deletion_eligible_at is not null;
create index paperwork_deletion_eligibility_idx
  on app_private.paperwork_records (deletion_eligible_at, facility_id, id)
  where deletion_eligible_at is not null;

create table app_private.legal_holds (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null
    references app_private.facilities(id) on delete restrict,
  scope_type text not null check (
    scope_type in (
      'facility',
      'incident',
      'report',
      'paperwork_record',
      'policy_document',
      'staff_member',
      'user_account'
    )
  ),
  scope_id uuid not null,
  authority_reference text not null check (
    char_length(authority_reference) between 3 and 160
    and authority_reference ~ '^[A-Za-z0-9][A-Za-z0-9 ._:/-]*$'
  ),
  created_by_account_id uuid not null
    references app_private.user_accounts(auth_user_id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  released_by_account_id uuid
    references app_private.user_accounts(auth_user_id) on delete restrict,
  released_at timestamptz,
  release_authority_reference text check (
    release_authority_reference is null or (
      char_length(release_authority_reference) between 3 and 160
      and release_authority_reference ~ '^[A-Za-z0-9][A-Za-z0-9 ._:/-]*$'
    )
  ),
  check (
    (released_by_account_id is null and released_at is null and release_authority_reference is null)
    or
    (released_by_account_id is not null and released_at is not null and release_authority_reference is not null)
  ),
  check (released_at is null or released_at >= created_at)
);

comment on table app_private.legal_holds is
  'Private legal-hold controls. An active matching hold blocks deletion regardless of the ordinary two-year eligibility date.';
comment on column app_private.legal_holds.authority_reference is
  'Bounded internal authority or case reference. Detailed narratives and record bodies do not belong in this field.';

create index legal_holds_active_scope_idx
  on app_private.legal_holds (facility_id, scope_type, scope_id, created_at desc)
  where released_at is null;
create index legal_holds_release_retention_idx
  on app_private.legal_holds (released_at, id)
  where released_at is not null;

create or replace function app_private.validate_legal_hold_target()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_facility_id uuid;
begin
  case new.scope_type
    when 'facility' then
      select facility.id into target_facility_id
      from app_private.facilities as facility
      where facility.id = new.scope_id;
    when 'incident' then
      select incident.facility_id into target_facility_id
      from app_private.incidents as incident
      where incident.id = new.scope_id;
    when 'report' then
      select incident.facility_id into target_facility_id
      from app_private.reports as report
      join app_private.incidents as incident on incident.id = report.incident_id
      where report.id = new.scope_id;
    when 'paperwork_record' then
      select record.facility_id into target_facility_id
      from app_private.paperwork_records as record
      where record.id = new.scope_id;
    when 'policy_document' then
      select document.facility_id into target_facility_id
      from app_private.policy_documents as document
      where document.id = new.scope_id;
    when 'staff_member' then
      select staff.facility_id into target_facility_id
      from app_private.staff_members as staff
      where staff.id = new.scope_id;
    when 'user_account' then
      select staff.facility_id into target_facility_id
      from app_private.user_accounts as account
      join app_private.staff_members as staff on staff.id = account.staff_member_id
      where account.auth_user_id = new.scope_id;
    else
      raise exception 'Unsupported legal hold scope';
  end case;

  if target_facility_id is null or target_facility_id <> new.facility_id then
    raise exception 'Legal hold target does not belong to the facility';
  end if;

  return new;
end;
$$;

comment on function app_private.validate_legal_hold_target() is
  'Private trigger that proves a legal-hold target exists within its declared facility boundary.';

revoke all on function app_private.validate_legal_hold_target()
  from public, anon, authenticated, service_role;

create trigger legal_holds_validate_target
before insert on app_private.legal_holds
for each row execute function app_private.validate_legal_hold_target();

create or replace function app_private.enforce_legal_hold_release()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.released_at is not null then
    raise exception 'A released legal hold is immutable';
  end if;

  if new.id <> old.id
    or new.facility_id <> old.facility_id
    or new.scope_type <> old.scope_type
    or new.scope_id <> old.scope_id
    or new.authority_reference <> old.authority_reference
    or new.created_by_account_id <> old.created_by_account_id
    or new.created_at <> old.created_at
    or new.released_by_account_id is null
    or new.released_at is null
    or new.release_authority_reference is null then
    raise exception 'A legal hold may only transition once to released';
  end if;

  return new;
end;
$$;

comment on function app_private.enforce_legal_hold_release() is
  'Private trigger that preserves hold identity and permits only one complete release transition.';

revoke all on function app_private.enforce_legal_hold_release()
  from public, anon, authenticated, service_role;

create trigger legal_holds_enforce_release
before update on app_private.legal_holds
for each row execute function app_private.enforce_legal_hold_release();

create trigger legal_holds_reject_delete
before delete on app_private.legal_holds
for each row execute function app_private.reject_mutation();

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

comment on function app_private.place_legal_hold(uuid, uuid, text, uuid, text) is
  'Private same-facility administrator operation that validates a hold target and writes allowlisted audit evidence.';

revoke all on function app_private.place_legal_hold(uuid, uuid, text, uuid, text)
  from public, anon, authenticated, service_role;

create or replace function app_private.release_legal_hold(
  p_actor_auth_user_id uuid,
  p_hold_id uuid,
  p_release_authority_reference text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  hold_record app_private.legal_holds%rowtype;
begin
  select hold.* into hold_record
  from app_private.legal_holds as hold
  where hold.id = p_hold_id
  for update;

  if not found or hold_record.released_at is not null then
    raise exception 'Active legal hold not found';
  end if;

  perform 1
  from app_private.user_accounts as account
  join app_private.staff_members as staff on staff.id = account.staff_member_id
  where account.auth_user_id = p_actor_auth_user_id
    and account.role = 'administrator'
    and account.status = 'active'
    and staff.status = 'active'
    and staff.facility_id = hold_record.facility_id;

  if not found then
    raise exception 'Active same-facility administrator required';
  end if;

  update app_private.legal_holds
  set released_by_account_id = p_actor_auth_user_id,
      released_at = statement_timestamp(),
      release_authority_reference = p_release_authority_reference
  where id = p_hold_id;

  insert into app_private.audit_events (
    facility_id,
    actor_auth_user_id,
    event_type,
    target_type,
    target_id,
    metadata
  ) values (
    hold_record.facility_id,
    p_actor_auth_user_id,
    'retention.legal_hold.released',
    'legal_hold',
    p_hold_id,
    jsonb_build_object('scope_type', hold_record.scope_type)
  );

  return true;
end;
$$;

comment on function app_private.release_legal_hold(uuid, uuid, text) is
  'Private same-facility administrator operation that releases one hold without deleting its evidence.';

revoke all on function app_private.release_legal_hold(uuid, uuid, text)
  from public, anon, authenticated, service_role;

create or replace function app_private.record_retention_status(
  p_as_of timestamptz default statement_timestamp()
)
returns table (
  record_type text,
  record_id uuid,
  facility_id uuid,
  archived_at timestamptz,
  deletion_eligible_at timestamptz,
  active_legal_hold boolean,
  deletion_ready boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with records as (
    select
      'incident'::text as record_type,
      incident.id as record_id,
      incident.facility_id,
      incident.archived_at,
      incident.deletion_eligible_at,
      null::uuid as parent_incident_id
    from app_private.incidents as incident
    where incident.archived_at is not null

    union all

    select
      'report'::text,
      report.id,
      incident.facility_id,
      report.archived_at,
      report.deletion_eligible_at,
      report.incident_id
    from app_private.reports as report
    join app_private.incidents as incident on incident.id = report.incident_id
    where report.archived_at is not null

    union all

    select
      'paperwork_record'::text,
      record.id,
      record.facility_id,
      record.archived_at,
      record.deletion_eligible_at,
      null::uuid
    from app_private.paperwork_records as record
    where record.archived_at is not null
  ), classified as (
    select
      record.*,
      exists (
        select 1
        from app_private.legal_holds as hold
        where hold.facility_id = record.facility_id
          and hold.released_at is null
          and (
            (hold.scope_type = 'facility' and hold.scope_id = record.facility_id)
            or (hold.scope_type = record.record_type and hold.scope_id = record.record_id)
            or (
              record.record_type = 'report'
              and hold.scope_type = 'incident'
              and hold.scope_id = record.parent_incident_id
            )
          )
      ) as active_legal_hold
    from records as record
  )
  select
    classified.record_type,
    classified.record_id,
    classified.facility_id,
    classified.archived_at,
    classified.deletion_eligible_at,
    classified.active_legal_hold,
    classified.deletion_eligible_at <= p_as_of
      and not classified.active_legal_hold as deletion_ready
  from classified
  order by classified.deletion_eligible_at, classified.record_type, classified.record_id;
$$;

comment on function app_private.record_retention_status(timestamptz) is
  'Private read-only classification of archived operational records. It never deletes data or supplies deletion authority.';

revoke all on function app_private.record_retention_status(timestamptz)
  from public, anon, authenticated, service_role;

alter table app_private.legal_holds enable row level security;
alter table app_private.legal_holds force row level security;

revoke all on table app_private.legal_holds
  from public, anon, authenticated, service_role;

commit;
