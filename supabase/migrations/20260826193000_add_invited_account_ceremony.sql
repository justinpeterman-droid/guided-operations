begin;

create or replace function app_private.stage_invited_account(
  p_actor_auth_user_id uuid,
  p_auth_user_id uuid,
  p_employee_lookup_hash text,
  p_employee_number_hint text,
  p_display_name text,
  p_role app_private.account_role,
  p_sign_in_alias text,
  p_temporary_passcode_expires_at timestamptz
) returns void language plpgsql security definer set search_path='' as $$
declare facility_id uuid; staff_id uuid;
begin
  if p_temporary_passcode_expires_at <= statement_timestamp()
     or p_temporary_passcode_expires_at > statement_timestamp() + interval '1 hour' then
    raise exception 'Invalid temporary passcode expiry';
  end if;
  select staff.facility_id into facility_id
    from app_private.user_accounts account join app_private.staff_members staff on staff.id=account.staff_member_id
    where account.auth_user_id=p_actor_auth_user_id and account.role='administrator'
      and account.status='active' and staff.status='active';
  if not found then raise exception 'Current active administrator required'; end if;
  insert into app_private.staff_members(facility_id,employee_lookup_hash,employee_number_hint,display_name,status)
    values(facility_id,p_employee_lookup_hash,p_employee_number_hint,p_display_name,'active') returning id into staff_id;
  insert into app_private.user_accounts(auth_user_id,staff_member_id,sign_in_alias,role,status,must_change_passcode,temporary_passcode_expires_at)
    values(p_auth_user_id,staff_id,p_sign_in_alias,p_role,'pending',true,p_temporary_passcode_expires_at);
  insert into app_private.audit_events(facility_id,actor_auth_user_id,event_type,target_type,target_id,metadata)
    values(facility_id,p_actor_auth_user_id,'account.invited.pending','account',p_auth_user_id,jsonb_build_object('outcome','awaiting_in_person_delivery'));
end; $$;

create or replace function app_private.activate_invited_account(p_actor_auth_user_id uuid,p_auth_user_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare facility_id uuid;
begin
  select staff.facility_id into facility_id
    from app_private.user_accounts actor join app_private.staff_members actor_staff on actor_staff.id=actor.staff_member_id
    join app_private.user_accounts account on account.auth_user_id=p_auth_user_id
    join app_private.staff_members staff on staff.id=account.staff_member_id
    where actor.auth_user_id=p_actor_auth_user_id and actor.role='administrator' and actor.status='active'
      and actor_staff.status='active' and staff.facility_id=actor_staff.facility_id and account.status='pending'
      and account.must_change_passcode and account.temporary_passcode_expires_at > statement_timestamp();
  if not found then raise exception 'Pending invited account unavailable'; end if;
  update app_private.user_accounts set status='active' where auth_user_id=p_auth_user_id and status='pending';
  insert into app_private.audit_events(facility_id,actor_auth_user_id,event_type,target_type,target_id,metadata)
    values(facility_id,p_actor_auth_user_id,'account.invited.activated','account',p_auth_user_id,jsonb_build_object('outcome','in_person_delivery_confirmed'));
end; $$;

create or replace function app_private.abandon_invited_account(p_actor_auth_user_id uuid,p_auth_user_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare facility_id uuid; staff_id uuid;
begin
  select staff.facility_id,account.staff_member_id into facility_id,staff_id
    from app_private.user_accounts actor join app_private.staff_members actor_staff on actor_staff.id=actor.staff_member_id
    join app_private.user_accounts account on account.auth_user_id=p_auth_user_id
    join app_private.staff_members staff on staff.id=account.staff_member_id
    where actor.auth_user_id=p_actor_auth_user_id and actor.role='administrator' and actor.status='active'
      and actor_staff.status='active' and staff.facility_id=actor_staff.facility_id and account.status='pending';
  if not found then raise exception 'Pending invited account unavailable'; end if;
  delete from app_private.user_accounts where auth_user_id=p_auth_user_id and status='pending';
  delete from app_private.staff_members where id=staff_id;
  insert into app_private.audit_events(facility_id,actor_auth_user_id,event_type,target_type,target_id,metadata)
    values(facility_id,p_actor_auth_user_id,'account.invited.abandoned','account',p_auth_user_id,jsonb_build_object('outcome','in_person_delivery_failed'));
end; $$;

revoke all on function app_private.stage_invited_account(uuid,uuid,text,text,text,app_private.account_role,text,timestamptz) from public,anon,authenticated,service_role;
revoke all on function app_private.activate_invited_account(uuid,uuid) from public,anon,authenticated,service_role;
revoke all on function app_private.abandon_invited_account(uuid,uuid) from public,anon,authenticated,service_role;
commit;
