begin;

create or replace function api.get_incident_summary(p_incident_id uuid)
returns table (
  incident_id uuid,
  incident_number text,
  display_name text,
  status text,
  occurred_at timestamptz,
  category text,
  current_revision_number integer,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_incident_id is null
    or not app_private.can_access_incident(p_incident_id) then
    return;
  end if;

  return query
    select
      incident.id,
      incident.incident_number,
      incident.display_name,
      incident.status,
      incident.occurred_at,
      incident.category,
      incident.current_revision_number,
      incident.updated_at
    from app_private.incidents as incident
    where incident.id = p_incident_id
      and incident.archived_at is null;
end;
$$;

comment on function api.get_incident_summary(uuid) is
  'Returns one summary-only incident after exact current-account authorization, without consulting a capped list.';

revoke all on function api.get_incident_summary(uuid)
  from public, anon, service_role;
grant execute on function api.get_incident_summary(uuid) to authenticated;

create or replace function api.list_incident_reports(p_incident_id uuid)
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
  v_actor_role text;
  v_actor_facility_id uuid;
begin
  if p_incident_id is null then
    return;
  end if;

  select account.role::text, staff.facility_id
    into v_actor_role, v_actor_facility_id
    from app_private.user_accounts as account
    join app_private.staff_members as staff
      on staff.id = account.staff_member_id
    where account.auth_user_id = auth.uid()
      and account.status = 'active'
      and staff.status = 'active';

  if not found
    or not app_private.can_access_incident(p_incident_id) then
    return;
  end if;

  return query
    select
      report.id,
      incident.incident_number,
      incident.display_name,
      report.report_type::text,
      report.status,
      report.current_revision_number,
      report.updated_at
    from app_private.reports as report
    join app_private.incidents as incident
      on incident.id = report.incident_id
    where report.incident_id = p_incident_id
      and report.archived_at is null
      and incident.archived_at is null
      and incident.facility_id = v_actor_facility_id
      and (
        v_actor_role = 'administrator'
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

comment on function api.list_incident_reports(uuid) is
  'Returns every report authorized for one exact incident, without filtering a globally capped index.';

revoke all on function api.list_incident_reports(uuid)
  from public, anon, service_role;
grant execute on function api.list_incident_reports(uuid) to authenticated;

commit;
