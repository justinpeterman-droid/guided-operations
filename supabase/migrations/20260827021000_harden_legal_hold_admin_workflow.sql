begin;

create or replace function app_private.list_legal_holds(
  p_actor_auth_user_id uuid,
  p_include_released boolean,
  p_limit integer
)
returns table (
  hold_id uuid,
  scope_type text,
  scope_id uuid,
  authority_reference text,
  created_at timestamptz,
  released_at timestamptz,
  release_authority_reference text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_facility_id uuid;
begin
  if p_include_released is null then
    raise exception 'Legal hold released-state flag is required';
  end if;

  if p_limit is null or p_limit < 1 or p_limit > 200 then
    raise exception 'Legal hold list limit must be between 1 and 200';
  end if;

  select staff.facility_id into actor_facility_id
  from app_private.user_accounts as account
  join app_private.staff_members as staff on staff.id = account.staff_member_id
  where account.auth_user_id = p_actor_auth_user_id
    and account.role = 'administrator'
    and account.status = 'active'
    and staff.status = 'active';

  if not found then
    raise exception 'Current active administrator required';
  end if;

  return query
  select
    hold.id,
    hold.scope_type,
    hold.scope_id,
    hold.authority_reference,
    hold.created_at,
    hold.released_at,
    hold.release_authority_reference
  from app_private.legal_holds as hold
  where hold.facility_id = actor_facility_id
    and (p_include_released or hold.released_at is null)
  order by
    (hold.released_at is null) desc,
    hold.created_at desc,
    hold.id
  limit p_limit;
end;
$$;

comment on function app_private.list_legal_holds(uuid, boolean, integer) is
  'Private bounded legal-hold register for a current same-facility administrator. Null filters and limits fail closed; no record bodies or personnel fields are returned.';

revoke all on function app_private.list_legal_holds(uuid, boolean, integer)
  from public, anon, authenticated, service_role;

commit;
