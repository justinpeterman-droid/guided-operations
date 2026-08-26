begin;

create or replace function api.get_report(p_report_id uuid)
returns table (
  report_id uuid,
  incident_id uuid,
  report_type text,
  status text,
  revision_number integer,
  report_revision_id uuid,
  source_incident_revision_id uuid,
  narrative text,
  schema_version integer,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_role text;
  actor_facility_id uuid;
begin
  if p_report_id is null then
    raise exception using errcode = '22023', message = 'Invalid report reference';
  end if;

  select account.role::text, staff.facility_id
    into actor_role, actor_facility_id
    from app_private.user_accounts as account
    join app_private.staff_members as staff on staff.id = account.staff_member_id
    where account.auth_user_id = auth.uid()
      and account.status = 'active'
      and staff.status = 'active';

  if not found then
    return;
  end if;

  return query
    select
      report.id,
      report.incident_id,
      report.report_type,
      report.status,
      revision.revision_number,
      revision.id,
      revision.source_incident_revision_id,
      revision.narrative,
      revision.schema_version,
      revision.created_at
    from app_private.reports as report
    join app_private.incidents as incident on incident.id = report.incident_id
    join app_private.report_revisions as revision
      on revision.report_id = report.id
      and revision.revision_number = report.current_revision_number
    where report.id = p_report_id
      and report.archived_at is null
      and incident.archived_at is null
      and incident.facility_id = actor_facility_id
      and (
        actor_role = 'administrator'
        or exists (
          select 1
          from app_private.report_access as access
          where access.report_id = report.id
            and access.account_id = auth.uid()
            and access.revoked_at is null
        )
      );
end;
$$;

comment on function api.get_report(uuid) is
  'Returns the current immutable report revision only to an active report collaborator or active same-facility administrator.';

revoke all on function api.get_report(uuid)
  from public, anon, service_role;
grant usage on schema api to authenticated;
grant execute on function api.get_report(uuid)
  to authenticated;

commit;
