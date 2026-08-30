begin;

create or replace function api.list_incidents(p_limit integer default 50)
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
declare
  actor_role text;
  actor_facility_id uuid;
begin
  if p_limit not between 1 and 100 then
    raise exception using errcode = '22023', message = 'Invalid incident list limit';
  end if;

  select account.role, staff.facility_id
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
      incident.id,
      incident.incident_number,
      incident.display_name,
      incident.status,
      incident.occurred_at,
      incident.category,
      incident.current_revision_number,
      incident.updated_at
    from app_private.incidents as incident
    where incident.facility_id = actor_facility_id
      and incident.archived_at is null
      and (
        actor_role = 'administrator'
        or incident.created_by_account_id = auth.uid()
      )
    order by incident.updated_at desc, incident.id desc
    limit p_limit;
end;
$$;

comment on function api.list_incidents(integer) is
  'Returns summary-only active incidents authorized for the authenticated current account.';

revoke all on function api.list_incidents(integer)
  from public, anon, service_role;
grant usage on schema api to authenticated;
grant execute on function api.list_incidents(integer) to authenticated;

commit;
