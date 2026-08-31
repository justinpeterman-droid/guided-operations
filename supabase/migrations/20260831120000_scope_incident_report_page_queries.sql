begin;

drop function api.get_incident_report_workspace(uuid);

create function api.get_incident_report_workspace(p_incident_id uuid)
returns table (
  incident_id uuid,
  incident_number text,
  display_name text,
  status text,
  occurred_at timestamptz,
  category text,
  updated_at timestamptz,
  incident_revision_id uuid,
  revision_number integer,
  schema_version integer,
  reviewed_facts jsonb,
  reporting_officers jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    incident.id,
    incident.incident_number,
    incident.display_name,
    incident.status,
    incident.occurred_at,
    incident.category,
    incident.updated_at,
    revision.id,
    revision.revision_number,
    revision.schema_version,
    revision.reviewed_facts,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'staffMemberId', staff.id,
            'displayName', staff.display_name,
            'employeeNumberHint', staff.employee_number_hint,
            'shiftCode', staff.shift_code
          )
          order by staff.display_name, staff.id
        )
        from app_private.incident_staff_relationships as relationship
        join app_private.staff_members as staff
          on staff.id = relationship.staff_member_id
        join app_private.user_accounts as account
          on account.staff_member_id = staff.id
        where relationship.incident_revision_id = revision.id
          and relationship.relationship = 'reporting_officer'
          and staff.status = 'active'
          and account.status = 'active'
      ),
      '[]'::jsonb
    )
  from app_private.incidents as incident
  join app_private.incident_revisions as revision
    on revision.incident_id = incident.id
   and revision.revision_number = incident.current_revision_number
  where incident.id = p_incident_id
    and app_private.can_access_incident(incident.id);
$$;

comment on function api.get_incident_report_workspace(uuid) is
  'Returns the current authorized incident summary, revision, reviewed facts, and minimum active reporting-officer fields needed by Document Studio.';

revoke all on function api.get_incident_report_workspace(uuid)
  from public, anon, service_role;
grant execute on function api.get_incident_report_workspace(uuid)
  to authenticated;

create function api.list_reports_for_incident(p_incident_id uuid)
returns table (
  report_id uuid,
  incident_number text,
  incident_name text,
  report_type text,
  status text,
  current_revision_number integer,
  updated_at timestamptz
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
      incident.incident_number,
      incident.display_name,
      report.report_type,
      report.status,
      report.current_revision_number,
      report.updated_at
    from app_private.reports as report
    join app_private.incidents as incident on incident.id = report.incident_id
    where report.incident_id = p_incident_id
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
      )
    order by report.updated_at desc, report.id desc;
end;
$$;

comment on function api.list_reports_for_incident(uuid) is
  'Returns every active report summary authorized for the current account and selected incident.';

revoke all on function api.list_reports_for_incident(uuid)
  from public, anon, service_role;
grant execute on function api.list_reports_for_incident(uuid)
  to authenticated;

commit;
