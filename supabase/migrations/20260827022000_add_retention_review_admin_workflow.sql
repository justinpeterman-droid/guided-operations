begin;

create or replace function app_private.list_retention_review_candidates(
  p_actor_auth_user_id uuid,
  p_as_of timestamptz,
  p_limit integer
)
returns table (
  record_type text,
  record_id uuid,
  archived_at timestamptz,
  deletion_eligible_at timestamptz,
  active_legal_hold boolean,
  deletion_ready boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_facility_id uuid;
begin
  if p_as_of is null or p_as_of > statement_timestamp() + interval '1 minute' then
    raise exception 'Retention review time must not be null or in the future';
  end if;

  if p_limit is null or p_limit < 1 or p_limit > 200 then
    raise exception 'Retention review limit must be between 1 and 200';
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
    status.record_type,
    status.record_id,
    status.archived_at,
    status.deletion_eligible_at,
    status.active_legal_hold,
    status.deletion_ready
  from app_private.record_retention_status(p_as_of) as status
  where status.facility_id = actor_facility_id
    and status.deletion_eligible_at <= p_as_of
  order by
    status.active_legal_hold,
    status.deletion_eligible_at,
    status.record_type,
    status.record_id
  limit p_limit;
end;
$$;

comment on function app_private.list_retention_review_candidates(uuid, timestamptz, integer) is
  'Private bounded same-facility administrator review of records that reached the two-year date. It never deletes data or grants deletion authority.';

revoke all on function app_private.list_retention_review_candidates(uuid, timestamptz, integer)
  from public, anon, authenticated, service_role;

commit;
