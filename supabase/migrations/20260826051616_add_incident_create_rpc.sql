begin;

create or replace function app_private.current_active_facility_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select staff.facility_id
  from app_private.user_accounts as account
  join app_private.staff_members as staff on staff.id = account.staff_member_id
  where account.auth_user_id = auth.uid()
    and account.status = 'active'
    and staff.status = 'active'
$$;

comment on function app_private.current_active_facility_id() is
  'Private authorization helper. It maps the authenticated JWT subject to an active facility.';

revoke all on function app_private.current_active_facility_id()
  from public, anon, authenticated, service_role;

create or replace function app_private.validate_incident_create_payload(
  p_incident_number text,
  p_display_name text,
  p_occurred_at timestamptz,
  p_category text,
  p_schema_version integer,
  p_field_notes jsonb,
  p_reviewed_facts jsonb
)
returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  note jsonb;
  fact jsonb;
  note_ids uuid[] := array[]::uuid[];
  fact_ids uuid[] := array[]::uuid[];
  source_note_id uuid;
begin
  if p_incident_number !~ '[^[:space:]]' or char_length(p_incident_number) > 80
    or p_display_name !~ '[^[:space:]]' or char_length(p_display_name) > 160
    or p_category !~ '[^[:space:]]' or char_length(p_category) > 100
    or p_schema_version <> 1
    or p_occurred_at is null then
    raise exception using errcode = '22023', message = 'Invalid incident metadata';
  end if;

  if jsonb_typeof(p_field_notes) <> 'array'
    or jsonb_array_length(p_field_notes) not between 1 and 200
    or jsonb_typeof(p_reviewed_facts) <> 'array'
    or jsonb_array_length(p_reviewed_facts) > 300 then
    raise exception using errcode = '22023', message = 'Invalid incident revision payload';
  end if;

  for note in select value from jsonb_array_elements(p_field_notes)
  loop
    if jsonb_typeof(note) <> 'object'
      or not note ?& array['id', 'recordedAt', 'text']
      or (select count(*) from jsonb_object_keys(note)) <> 3
      or coalesce(char_length(note->>'text'), 0) not between 1 and 20000 then
      raise exception using errcode = '22023', message = 'Invalid field note';
    end if;

    begin
      note_ids := array_append(note_ids, (note->>'id')::uuid);
      perform (note->>'recordedAt')::timestamptz;
    exception when invalid_text_representation or datetime_field_overflow then
      raise exception using errcode = '22023', message = 'Invalid field note';
    end;
  end loop;

  if cardinality(note_ids) <> cardinality(array(select distinct unnest(note_ids))) then
    raise exception using errcode = '22023', message = 'Duplicate field note identifier';
  end if;

  for fact in select value from jsonb_array_elements(p_reviewed_facts)
  loop
    if jsonb_typeof(fact) <> 'object'
      or coalesce(char_length(fact->>'field'), 0) not between 1 and 120
      or fact->>'state' not in ('confirmed', 'unknown', 'not_applicable') then
      raise exception using errcode = '22023', message = 'Invalid reviewed fact';
    end if;

    begin
      fact_ids := array_append(fact_ids, (fact->>'id')::uuid);
    exception when invalid_text_representation then
      raise exception using errcode = '22023', message = 'Invalid reviewed fact';
    end;

    if fact->>'state' = 'confirmed' then
      if not fact ?& array['field', 'id', 'sourceNoteIds', 'state', 'value']
        or (select count(*) from jsonb_object_keys(fact)) <> 5
        or coalesce(char_length(fact->>'value'), 0) not between 1 and 8000
        or jsonb_typeof(fact->'sourceNoteIds') <> 'array'
        or jsonb_array_length(fact->'sourceNoteIds') not between 1 and 100 then
        raise exception using errcode = '22023', message = 'Invalid confirmed fact';
      end if;

      for source_note_id in
        select value::text::uuid from jsonb_array_elements_text(fact->'sourceNoteIds') as value
      loop
        if not source_note_id = any(note_ids) then
          raise exception using errcode = '22023', message = 'Confirmed fact source is not in this revision';
        end if;
      end loop;
    elsif not fact ?& array['field', 'id', 'reason', 'state']
      or (select count(*) from jsonb_object_keys(fact)) <> 4
      or coalesce(char_length(fact->>'reason'), 0) not between 1 and 500 then
      raise exception using errcode = '22023', message = 'Invalid limited fact';
    end if;
  end loop;

  if cardinality(fact_ids) <> cardinality(array(select distinct unnest(fact_ids))) then
    raise exception using errcode = '22023', message = 'Duplicate reviewed fact identifier';
  end if;
end;
$$;

revoke all on function app_private.validate_incident_create_payload(
  text, text, timestamptz, text, integer, jsonb, jsonb
) from public, anon, authenticated, service_role;

create or replace function api.create_incident(
  p_facility_id uuid,
  p_incident_number text,
  p_display_name text,
  p_occurred_at timestamptz,
  p_category text,
  p_schema_version integer,
  p_field_notes jsonb,
  p_reviewed_facts jsonb,
  p_idempotency_key_digest text,
  p_request_digest text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_account_id uuid := auth.uid();
  existing_request_digest text;
  existing_status text;
  existing_incident_id uuid;
  incident_id uuid;
begin
  if v_actor_account_id is null
    or app_private.current_active_facility_id() is distinct from p_facility_id then
    raise exception using errcode = '42501', message = 'Not authorized to create an incident';
  end if;

  if p_idempotency_key_digest !~ '^[a-f0-9]{64}$'
    or p_request_digest !~ '^[a-f0-9]{64}$' then
    raise exception using errcode = '22023', message = 'Invalid retry metadata';
  end if;

  perform app_private.validate_incident_create_payload(
    p_incident_number,
    p_display_name,
    p_occurred_at,
    p_category,
    p_schema_version,
    p_field_notes,
    p_reviewed_facts
  );

  select record.request_digest, record.status, record.result_reference_id
    into existing_request_digest, existing_status, existing_incident_id
    from app_private.idempotency_records as record
    where record.actor_account_id = v_actor_account_id
      and record.action = 'incident.create'
      and record.idempotency_key_digest = p_idempotency_key_digest
    for update;

  if found then
    if existing_request_digest <> p_request_digest then
      raise exception using errcode = '22023', message = 'Retry key was reused for a different request';
    end if;
    if existing_status = 'succeeded' and existing_incident_id is not null then
      return existing_incident_id;
    end if;
    raise exception using errcode = '40001', message = 'Incident creation is already in progress';
  end if;

  insert into app_private.idempotency_records (
    actor_account_id,
    action,
    idempotency_key_digest,
    request_digest,
    expires_at
  ) values (
    v_actor_account_id,
    'incident.create',
    p_idempotency_key_digest,
    p_request_digest,
    statement_timestamp() + interval '24 hours'
  );

  insert into app_private.incidents (
    facility_id,
    created_by_account_id,
    incident_number,
    display_name,
    occurred_at,
    category
  ) values (
    p_facility_id,
    v_actor_account_id,
    btrim(p_incident_number),
    btrim(p_display_name),
    p_occurred_at,
    btrim(p_category)
  ) returning id into incident_id;

  insert into app_private.incident_revisions (
    incident_id,
    revision_number,
    editor_account_id,
    schema_version,
    field_notes,
    reviewed_facts
  ) values (
    incident_id,
    1,
    v_actor_account_id,
    p_schema_version,
    p_field_notes,
    p_reviewed_facts
  );

  update app_private.idempotency_records as record
    set status = 'succeeded',
        result_reference_id = incident_id,
        result_code = 'incident.created'
    where record.actor_account_id = v_actor_account_id
      and action = 'incident.create'
      and idempotency_key_digest = p_idempotency_key_digest;

  return incident_id;
end;
$$;

comment on function api.create_incident(
  uuid, text, text, timestamptz, text, integer, jsonb, jsonb, text, text
) is
  'Creates an incident and its first immutable revision atomically. The actor is always auth.uid().';

revoke all on function api.create_incident(
  uuid, text, text, timestamptz, text, integer, jsonb, jsonb, text, text
) from public, anon, service_role;
grant usage on schema api to authenticated;
grant execute on function api.create_incident(
  uuid, text, text, timestamptz, text, integer, jsonb, jsonb, text, text
) to authenticated;

commit;
