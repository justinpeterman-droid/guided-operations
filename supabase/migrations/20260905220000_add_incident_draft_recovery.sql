begin;

create table app_private.incident_drafts (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references app_private.facilities(id) on delete restrict,
  owner_account_id uuid not null references app_private.user_accounts(auth_user_id) on delete restrict,
  schema_version smallint not null check (schema_version = 1),
  revision_number integer not null default 1 check (revision_number > 0),
  lifecycle_status text not null default 'draft' check (lifecycle_status in ('draft', 'discarded', 'promoted')),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  incident_number_summary text null check (char_length(incident_number_summary) <= 80),
  incident_name_summary text null check (char_length(incident_name_summary) <= 160),
  last_request_digest text not null check (last_request_digest ~ '^[a-f0-9]{64}$'),
  promoted_incident_id uuid null references app_private.incidents(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  discarded_at timestamptz null,
  promoted_at timestamptz null,
  check (
    (lifecycle_status = 'draft' and discarded_at is null and promoted_at is null and promoted_incident_id is null)
    or (lifecycle_status = 'discarded' and discarded_at is not null and promoted_at is null and promoted_incident_id is null)
    or (lifecycle_status = 'promoted' and discarded_at is null and promoted_at is not null and promoted_incident_id is not null)
  )
);

comment on table app_private.incident_drafts is
  'Private unfinished incident input. Discard changes lifecycle state; operational retention and legal holds govern any later deletion procedure.';
create index incident_drafts_owner_active_updated_idx on app_private.incident_drafts (owner_account_id, updated_at desc, id desc) where lifecycle_status = 'draft';
create unique index incident_drafts_promoted_incident_idx on app_private.incident_drafts (promoted_incident_id) where promoted_incident_id is not null;
alter table app_private.incident_drafts enable row level security;
alter table app_private.incident_drafts force row level security;
revoke all on table app_private.incident_drafts from public, anon, authenticated, service_role;

create trigger guided_operations_backup_freeze_fb52b426700ca080
before insert or update or delete or truncate on app_private.incident_drafts
for each statement execute function app_private.require_no_production_backup_write_freeze();

create or replace function api.list_incident_drafts(p_limit integer default 20)
returns table (draft_id uuid, revision_number integer, incident_number text, incident_name text, saved_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare v_actor uuid;
begin
  if p_limit is null or p_limit not between 1 and 50 then return; end if;
  select account.auth_user_id into v_actor from app_private.user_accounts account join app_private.staff_members staff on staff.id = account.staff_member_id where account.auth_user_id = auth.uid() and account.status = 'active' and staff.status = 'active';
  if not found then return; end if;
  return query select draft.id, draft.revision_number, draft.incident_number_summary, draft.incident_name_summary, draft.updated_at from app_private.incident_drafts draft where draft.owner_account_id = v_actor and draft.lifecycle_status = 'draft' order by draft.updated_at desc, draft.id desc limit p_limit;
end;
$$;

create or replace function api.get_incident_draft(p_draft_id uuid)
returns table (draft_id uuid, revision_number integer, schema_version smallint, payload jsonb, incident_number text, incident_name text, saved_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_draft_id is null then return; end if;
  return query select draft.id, draft.revision_number, draft.schema_version, draft.payload, draft.incident_number_summary, draft.incident_name_summary, draft.updated_at from app_private.incident_drafts draft join app_private.user_accounts account on account.auth_user_id = draft.owner_account_id join app_private.staff_members staff on staff.id = account.staff_member_id where draft.id = p_draft_id and draft.owner_account_id = auth.uid() and draft.lifecycle_status = 'draft' and account.status = 'active' and staff.status = 'active';
end;
$$;

create or replace function api.save_incident_draft(p_draft_id uuid, p_expected_revision integer, p_schema_version smallint, p_payload jsonb, p_incident_number text, p_incident_name text, p_request_digest text)
returns table (draft_id uuid, revision_number integer, saved_at timestamptz, outcome text)
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid; v_facility uuid; v_draft app_private.incident_drafts%rowtype; v_number text; v_name text;
begin
  select account.auth_user_id, staff.facility_id into v_actor, v_facility from app_private.user_accounts account join app_private.staff_members staff on staff.id = account.staff_member_id where account.auth_user_id = auth.uid() and account.status = 'active' and staff.status = 'active';
  if not found then return; end if;
  if p_schema_version <> 1 or jsonb_typeof(p_payload) <> 'object' or p_request_digest !~ '^[a-f0-9]{64}$' or (p_draft_id is null) <> (p_expected_revision is null) or coalesce(p_expected_revision, 1) < 1 then raise exception using errcode = '22023', message = 'Invalid incident draft request'; end if;
  v_number := nullif(btrim(coalesce(p_incident_number, '')), ''); v_name := nullif(btrim(coalesce(p_incident_name, '')), '');
  if char_length(coalesce(v_number, '')) > 80 or char_length(coalesce(v_name, '')) > 160 then raise exception using errcode = '22023', message = 'Invalid incident draft summary'; end if;
  if p_draft_id is null then
    insert into app_private.incident_drafts (facility_id, owner_account_id, schema_version, payload, incident_number_summary, incident_name_summary, last_request_digest) values (v_facility, v_actor, p_schema_version, p_payload, v_number, v_name, p_request_digest) returning * into v_draft;
    return query select v_draft.id, v_draft.revision_number, v_draft.updated_at, 'saved'::text; return;
  end if;
  select * into v_draft from app_private.incident_drafts draft where draft.id = p_draft_id and draft.owner_account_id = v_actor and draft.facility_id = v_facility and draft.lifecycle_status = 'draft' for update;
  if not found then return query select p_draft_id, null::integer, null::timestamptz, 'conflict'::text; return; end if;
  if v_draft.revision_number = p_expected_revision then
    update app_private.incident_drafts draft set revision_number = draft.revision_number + 1, payload = p_payload, incident_number_summary = v_number, incident_name_summary = v_name, last_request_digest = p_request_digest, updated_at = statement_timestamp() where draft.id = v_draft.id returning * into v_draft;
    return query select v_draft.id, v_draft.revision_number, v_draft.updated_at, 'saved'::text; return;
  end if;
  if v_draft.revision_number = p_expected_revision + 1 and v_draft.last_request_digest = p_request_digest then return query select v_draft.id, v_draft.revision_number, v_draft.updated_at, 'saved'::text; return; end if;
  return query select v_draft.id, v_draft.revision_number, v_draft.updated_at, 'conflict'::text;
end;
$$;

create or replace function api.discard_incident_draft(p_draft_id uuid) returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update app_private.incident_drafts draft set lifecycle_status = 'discarded', discarded_at = statement_timestamp(), updated_at = statement_timestamp() where draft.id = p_draft_id and draft.owner_account_id = auth.uid() and draft.lifecycle_status = 'draft';
  return found;
end;
$$;

create or replace function api.mark_incident_draft_promoted(p_draft_id uuid, p_incident_id uuid) returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update app_private.incident_drafts draft set lifecycle_status = 'promoted', promoted_incident_id = p_incident_id, promoted_at = statement_timestamp(), updated_at = statement_timestamp() where draft.id = p_draft_id and draft.owner_account_id = auth.uid() and draft.lifecycle_status = 'draft' and exists (select 1 from app_private.incidents incident where incident.id = p_incident_id and incident.facility_id = draft.facility_id and incident.created_by_account_id = auth.uid());
  if found then return true; end if;
  return exists (select 1 from app_private.incident_drafts draft where draft.id = p_draft_id and draft.owner_account_id = auth.uid() and draft.lifecycle_status = 'promoted' and draft.promoted_incident_id = p_incident_id);
end;
$$;

comment on function api.save_incident_draft(uuid, integer, smallint, jsonb, text, text, text) is 'Creates or revision-checks private unfinished incident input. A matching request digest safely acknowledges one lost response without overwriting newer input.';
revoke all on function api.list_incident_drafts(integer), api.get_incident_draft(uuid), api.save_incident_draft(uuid, integer, smallint, jsonb, text, text, text), api.discard_incident_draft(uuid), api.mark_incident_draft_promoted(uuid, uuid) from public, anon, service_role;
grant usage on schema api to authenticated;
grant execute on function api.list_incident_drafts(integer), api.get_incident_draft(uuid), api.save_incident_draft(uuid, integer, smallint, jsonb, text, text, text), api.discard_incident_draft(uuid), api.mark_incident_draft_promoted(uuid, uuid) to authenticated;

commit;
