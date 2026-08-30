begin;

create function api.get_incident_report_workspace(p_incident_id uuid)
returns table (
  incident_id uuid,
  incident_number text,
  display_name text,
  category text,
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
    incident.category,
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
  'Returns the current authorized incident revision, reviewed facts, and minimum active reporting-officer display fields needed to request an attributed draft.';

revoke all on function api.get_incident_report_workspace(uuid)
  from public, anon, service_role;
grant usage on schema api to authenticated;
grant execute on function api.get_incident_report_workspace(uuid)
  to authenticated;

commit;
