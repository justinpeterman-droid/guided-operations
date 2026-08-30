begin;

create or replace function api.list_reports(p_limit integer default 50)
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
  if p_limit not between 1 and 100 then
    raise exception using errcode = '22023', message = 'Invalid report list limit';
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
      incident.incident_number,
      incident.display_name,
      report.report_type,
      report.status,
      report.current_revision_number,
      report.updated_at
    from app_private.reports as report
    join app_private.incidents as incident on incident.id = report.incident_id
    where report.archived_at is null
      and incident.archived_at is null
      and incident.facility_id = actor_facility_id
      and (
        actor_role = 'administrator'
        or exists (
          select 1 from app_private.report_access as access
          where access.report_id = report.id
            and access.account_id = auth.uid()
            and access.revoked_at is null
        )
      )
    order by report.updated_at desc, report.id desc
    limit p_limit;
end;
$$;

comment on function api.list_reports(integer) is
  'Returns summary-only active reports authorized for the authenticated current account.';

revoke all on function api.list_reports(integer)
  from public, anon, service_role;
grant usage on schema api to authenticated;
grant execute on function api.list_reports(integer) to authenticated;

commit;
