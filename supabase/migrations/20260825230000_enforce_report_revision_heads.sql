begin;

create or replace function app_private.enforce_incident_revision_sequence()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_head integer;
begin
  select incident.current_revision_number
    into strict current_head
    from app_private.incidents as incident
    where incident.id = new.incident_id
    for update;

  if new.revision_number <> current_head + 1 then
    raise exception 'Incident revision must advance exactly one revision from the current head';
  end if;

  return new;
end;
$$;

comment on function app_private.enforce_incident_revision_sequence() is
  'Private serialized guard that accepts only the next incident revision number.';

revoke all on function app_private.enforce_incident_revision_sequence()
  from public, anon, authenticated, service_role;

create trigger incident_revisions_enforce_sequence
before insert on app_private.incident_revisions
for each row execute function app_private.enforce_incident_revision_sequence();

create or replace function app_private.advance_incident_revision_head()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update app_private.incidents as incident
    set current_revision_number = new.revision_number,
        updated_at = statement_timestamp()
    where incident.id = new.incident_id
      and incident.current_revision_number = new.revision_number - 1;

  if not found then
    raise exception 'Incident revision head changed before it could be advanced';
  end if;

  return new;
end;
$$;

comment on function app_private.advance_incident_revision_head() is
  'Private trigger that advances an incident head only after its immutable revision is inserted.';

revoke all on function app_private.advance_incident_revision_head()
  from public, anon, authenticated, service_role;

create trigger incident_revisions_advance_head
after insert on app_private.incident_revisions
for each row execute function app_private.advance_incident_revision_head();

create or replace function app_private.enforce_report_revision_sequence()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_head integer;
  report_incident_id uuid;
  source_incident_id uuid;
begin
  select report.current_revision_number, report.incident_id
    into strict current_head, report_incident_id
    from app_private.reports as report
    where report.id = new.report_id
    for update;

  select revision.incident_id
    into strict source_incident_id
    from app_private.incident_revisions as revision
    where revision.id = new.source_incident_revision_id;

  if new.revision_number <> current_head + 1 then
    raise exception 'Report revision must advance exactly one revision from the current head';
  end if;

  if source_incident_id <> report_incident_id then
    raise exception 'A report revision must reference a revision from its own incident';
  end if;

  return new;
end;
$$;

comment on function app_private.enforce_report_revision_sequence() is
  'Private serialized guard for report revision order and source-incident consistency.';

revoke all on function app_private.enforce_report_revision_sequence()
  from public, anon, authenticated, service_role;

create trigger report_revisions_enforce_sequence
before insert on app_private.report_revisions
for each row execute function app_private.enforce_report_revision_sequence();

create or replace function app_private.advance_report_revision_head()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update app_private.reports as report
    set current_revision_number = new.revision_number,
        updated_at = statement_timestamp()
    where report.id = new.report_id
      and report.current_revision_number = new.revision_number - 1;

  if not found then
    raise exception 'Report revision head changed before it could be advanced';
  end if;

  return new;
end;
$$;

comment on function app_private.advance_report_revision_head() is
  'Private trigger that advances a report head only after its immutable revision is inserted.';

revoke all on function app_private.advance_report_revision_head()
  from public, anon, authenticated, service_role;

create trigger report_revisions_advance_head
after insert on app_private.report_revisions
for each row execute function app_private.advance_report_revision_head();

commit;
