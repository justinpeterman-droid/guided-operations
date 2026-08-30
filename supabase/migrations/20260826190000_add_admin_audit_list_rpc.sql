begin;

create or replace function api.list_admin_audit_events(p_limit integer default 50)
returns table (
  event_id uuid,
  event_type text,
  target_type text,
  outcome text,
  occurred_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_facility_id uuid;
begin
  if p_limit not between 1 and 100 then
    raise exception using errcode = '22023', message = 'Invalid audit list limit';
  end if;

  select staff.facility_id
    into actor_facility_id
    from app_private.user_accounts as account
    join app_private.staff_members as staff on staff.id = account.staff_member_id
    where account.auth_user_id = auth.uid()
      and account.role = 'administrator'
      and account.status = 'active'
      and staff.status = 'active';

  if not found then
    return;
  end if;

  return query
    select
      event.event_id,
      event.event_type,
      event.target_type,
      nullif(left(event.metadata ->> 'outcome', 80), ''),
      event.occurred_at
    from app_private.audit_events as event
    where event.facility_id = actor_facility_id
    order by event.occurred_at desc, event.id desc
    limit p_limit;
end;
$$;

comment on function api.list_admin_audit_events(integer) is
  'Returns only bounded allowlisted audit summary fields to an active administrator. It excludes employee identifiers, narratives, policy text, credentials, tokens, prompts, and source content.';

revoke all on function api.list_admin_audit_events(integer)
  from public, anon, service_role;
grant usage on schema api to authenticated;
grant execute on function api.list_admin_audit_events(integer) to authenticated;

commit;
