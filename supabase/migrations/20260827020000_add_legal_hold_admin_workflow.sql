begin;

alter table app_private.admin_step_ups
  drop constraint admin_step_ups_purpose_check;

alter table app_private.admin_step_ups
  add constraint admin_step_ups_purpose_check check (
    purpose in (
      'account.create',
      'account.reset_passcode',
      'account.unlock',
      'account.change_role',
      'account.change_shift',
      'account.disable',
      'policy.promote',
      'retention.place_legal_hold',
      'retention.release_legal_hold',
      'system.destructive_cleanup'
    )
  );

create index legal_holds_active_facility_created_idx
  on app_private.legal_holds (facility_id, created_at desc, id)
  where released_at is null;

create or replace function app_private.place_legal_hold(
  p_actor_auth_user_id uuid,
  p_scope_type text,
  p_scope_id uuid,
  p_authority_reference text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_facility_id uuid;
begin
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

  return app_private.place_legal_hold(
    p_actor_auth_user_id,
    actor_facility_id,
    p_scope_type,
    p_scope_id,
    p_authority_reference
  );
end;
$$;

comment on function app_private.place_legal_hold(uuid, text, uuid, text) is
  'Private administrator workflow entry point that derives the actor facility rather than accepting a client-selected facility.';

revoke all on function app_private.place_legal_hold(uuid, text, uuid, text)
  from public, anon, authenticated, service_role;

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
  if p_limit < 1 or p_limit > 200 then
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
  'Private bounded legal-hold register for a current same-facility administrator. It returns no record bodies or personnel fields.';

revoke all on function app_private.list_legal_holds(uuid, boolean, integer)
  from public, anon, authenticated, service_role;

commit;
