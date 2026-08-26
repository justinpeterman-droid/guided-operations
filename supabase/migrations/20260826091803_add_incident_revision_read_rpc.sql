begin;

create or replace function api.get_incident_revision(
  p_incident_id uuid,
  p_revision_number integer
)
returns table (
  incident_id uuid,
  incident_number text,
  display_name text,
  incident_revision_id uuid,
  revision_number integer,
  schema_version integer,
  reviewed_facts jsonb
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
  if p_incident_id is null or p_revision_number < 1 then
    raise exception using errcode = '22023', message = 'Invalid incident revision reference';
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
      incident.id,
      incident.incident_number,
      incident.display_name,
      revision.id,
      revision.revision_number,
      revision.schema_version,
      revision.reviewed_facts
    from app_private.incidents as incident
    join app_private.incident_revisions as revision
      on revision.incident_id = incident.id
    where incident.id = p_incident_id
      and incident.facility_id = actor_facility_id
      and incident.archived_at is null
      and revision.revision_number = p_revision_number
      and (
        actor_role = 'administrator'
        or incident.created_by_account_id = auth.uid()
      );
end;
$$;

comment on function api.get_incident_revision(uuid, integer) is
  'Returns one immutable revision only to its active owner or an active same-facility administrator.';

revoke all on function api.get_incident_revision(uuid, integer)
  from public, anon, service_role;
grant usage on schema api to authenticated;
grant execute on function api.get_incident_revision(uuid, integer)
  to authenticated;

commit;
