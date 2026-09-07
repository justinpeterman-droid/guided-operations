begin;

-- A new forward migration preserves the original local draft migration.
create function app_private.current_incident_draft_facility_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select app_private.current_policy_facility_id()
$$;
revoke all on function app_private.current_incident_draft_facility_id() from public, anon, authenticated, service_role;

alter table app_private.incident_drafts add constraint incident_draft_payload_size check (octet_length(payload::text) <= 1048576);
-- Promoted drafts follow the incident's existing controlled retention deletion.
alter table app_private.incident_drafts drop constraint incident_drafts_promoted_incident_id_fkey;
alter table app_private.incident_drafts add constraint incident_drafts_promoted_incident_id_fkey foreign key (promoted_incident_id) references app_private.incidents(id) on delete cascade;

create or replace function api.list_incident_drafts(p_limit integer default 20)
returns table (draft_id uuid, revision_number integer, incident_number text, incident_name text, saved_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare v_facility uuid := app_private.current_incident_draft_facility_id();
begin
  if v_facility is null or p_limit is null or p_limit not between 1 and 50 then return; end if;
  return query select d.id, d.revision_number, d.incident_number_summary, d.incident_name_summary, d.updated_at
    from app_private.incident_drafts d where d.owner_account_id = auth.uid() and d.facility_id = v_facility and d.lifecycle_status = 'draft'
    order by d.updated_at desc, d.id desc limit p_limit;
end; $$;

create or replace function api.get_incident_draft(p_draft_id uuid)
returns table (draft_id uuid, revision_number integer, schema_version smallint, payload jsonb, incident_number text, incident_name text, saved_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare v_facility uuid := app_private.current_incident_draft_facility_id();
begin
  if v_facility is null then return; end if;
  return query select d.id, d.revision_number, d.schema_version, d.payload, d.incident_number_summary, d.incident_name_summary, d.updated_at
    from app_private.incident_drafts d where d.id = p_draft_id and d.owner_account_id = auth.uid() and d.facility_id = v_facility and d.lifecycle_status = 'draft';
end; $$;

create or replace function api.save_incident_draft(p_draft_id uuid, p_expected_revision integer, p_schema_version smallint, p_payload jsonb, p_incident_number text, p_incident_name text, p_request_digest text)
returns table (draft_id uuid, revision_number integer, saved_at timestamptz, outcome text)
language plpgsql security definer set search_path = '' as $$
declare v_facility uuid := app_private.current_incident_draft_facility_id(); v_draft app_private.incident_drafts%rowtype;
begin
  if v_facility is null then return; end if;
  if p_draft_id is null or p_expected_revision is null or p_expected_revision < 0
    or p_schema_version is distinct from 1 or jsonb_typeof(p_payload) is distinct from 'object'
    or p_request_digest is null or p_request_digest !~ '^[a-f0-9]{64}$'
    or octet_length(p_payload::text) > 1048576
    or char_length(coalesce(p_incident_number,'')) > 80 or char_length(coalesce(p_incident_name,'')) > 160 then
    raise exception using errcode = '22023', message = 'Invalid incident draft request';
  end if;
  if p_expected_revision = 0 then
    insert into app_private.incident_drafts(id,facility_id,owner_account_id,schema_version,payload,incident_number_summary,incident_name_summary,last_request_digest)
      values(p_draft_id,v_facility,auth.uid(),p_schema_version,p_payload,nullif(btrim(p_incident_number),''),nullif(btrim(p_incident_name),''),p_request_digest)
      on conflict(id) do nothing;
  end if;
  select * into v_draft from app_private.incident_drafts d where d.id=p_draft_id and d.owner_account_id=auth.uid() and d.facility_id=v_facility and d.lifecycle_status='draft' for update;
  if not found then return query select p_draft_id,null::integer,null::timestamptz,'conflict'::text; return; end if;
  if v_draft.revision_number=p_expected_revision+1 and v_draft.last_request_digest=p_request_digest
    and v_draft.payload=p_payload and v_draft.incident_number_summary is not distinct from nullif(btrim(p_incident_number),'') and v_draft.incident_name_summary is not distinct from nullif(btrim(p_incident_name),'') then
    return query select v_draft.id,v_draft.revision_number,v_draft.updated_at,'saved'::text; return;
  end if;
  if v_draft.revision_number<>p_expected_revision then
    return query select v_draft.id,v_draft.revision_number,v_draft.updated_at,'conflict'::text; return;
  end if;
  update app_private.incident_drafts d set revision_number=d.revision_number+1,payload=p_payload,incident_number_summary=nullif(btrim(p_incident_number),''),incident_name_summary=nullif(btrim(p_incident_name),''),last_request_digest=p_request_digest,updated_at=statement_timestamp()
    where d.id=v_draft.id returning * into v_draft;
  return query select v_draft.id,v_draft.revision_number,v_draft.updated_at,'saved'::text;
end; $$;

drop function api.discard_incident_draft(uuid);
create function api.discard_incident_draft(p_draft_id uuid, p_expected_revision integer) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_facility uuid := app_private.current_incident_draft_facility_id();
begin
  if v_facility is null then return false; end if;
  update app_private.incident_drafts d set lifecycle_status='discarded',discarded_at=statement_timestamp(),updated_at=statement_timestamp()
    where d.id=p_draft_id and d.owner_account_id=auth.uid() and d.facility_id=v_facility and d.lifecycle_status='draft' and d.revision_number=p_expected_revision;
  if found then return true; end if;
  return exists(select 1 from app_private.incident_drafts d where d.id=p_draft_id and d.owner_account_id=auth.uid() and d.facility_id=v_facility and d.lifecycle_status='discarded' and d.revision_number=p_expected_revision);
end; $$;

revoke all on function api.discard_incident_draft(uuid,integer) from public,anon,service_role;
grant execute on function api.discard_incident_draft(uuid,integer) to authenticated;

-- The former separate promotion endpoint cannot be invoked by a client.
revoke all on function api.mark_incident_draft_promoted(uuid,uuid) from public,anon,authenticated,service_role;

create function api.create_incident_from_draft(
  p_draft_id uuid, p_draft_revision integer, p_facility_id uuid, p_incident_number text,
  p_display_name text, p_occurred_at timestamptz, p_category text, p_schema_version integer,
  p_field_notes jsonb, p_reviewed_facts jsonb, p_staff_relationships jsonb,
  p_idempotency_key_digest text, p_request_digest text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_facility uuid := app_private.current_incident_draft_facility_id(); v_draft app_private.incident_drafts%rowtype; v_incident uuid;
begin
  if v_facility is null or p_facility_id is distinct from v_facility then
    raise exception using errcode='42501',message='Incident draft unavailable';
  end if;
  select * into v_draft from app_private.incident_drafts d where d.id=p_draft_id and d.owner_account_id=auth.uid() and d.facility_id=v_facility for update;
  if not found or v_draft.lifecycle_status='discarded' or v_draft.revision_number is distinct from p_draft_revision then
    raise exception using errcode='40001',message='Incident draft changed';
  end if;
  v_incident := api.create_incident(p_facility_id,p_incident_number,p_display_name,p_occurred_at,p_category,p_schema_version,p_field_notes,p_reviewed_facts,p_staff_relationships,p_idempotency_key_digest,p_request_digest);
  if v_draft.lifecycle_status='promoted' then
    if v_draft.promoted_incident_id is distinct from v_incident then
      raise exception using errcode='40001',message='Incident draft already promoted';
    end if;
    return v_incident;
  end if;
  update app_private.incident_drafts set lifecycle_status='promoted',promoted_incident_id=v_incident,promoted_at=statement_timestamp(),updated_at=statement_timestamp() where id=v_draft.id;
  return v_incident;
end; $$;
revoke all on function api.create_incident_from_draft(uuid,integer,uuid,text,text,timestamptz,text,integer,jsonb,jsonb,jsonb,text,text) from public,anon,service_role;
grant execute on function api.create_incident_from_draft(uuid,integer,uuid,text,text,timestamptz,text,integer,jsonb,jsonb,jsonb,text,text) to authenticated;
commit;
