begin;

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
  reporting_staff_member_id uuid;
  reporting_staff_member_ids uuid[];
begin
  if p_incident_number !~ '[^[:space:]]' or char_length(p_incident_number) > 80
    or p_display_name !~ '[^[:space:]]' or char_length(p_display_name) > 160
    or p_category !~ '[^[:space:]]' or char_length(p_category) > 100
    or p_schema_version <> 2
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
      if not fact ?& array[
          'field',
          'id',
          'reportingStaffMemberIds',
          'sourceNoteIds',
          'state',
          'value'
        ]
        or (select count(*) from jsonb_object_keys(fact)) <> 6
        or coalesce(char_length(fact->>'value'), 0) not between 1 and 8000
        or jsonb_typeof(fact->'sourceNoteIds') <> 'array'
        or jsonb_array_length(fact->'sourceNoteIds') not between 1 and 100
        or jsonb_typeof(fact->'reportingStaffMemberIds') <> 'array'
        or jsonb_array_length(fact->'reportingStaffMemberIds') > 20 then
        raise exception using errcode = '22023', message = 'Invalid confirmed fact';
      end if;

      begin
        for source_note_id in
          select value::text::uuid
          from jsonb_array_elements_text(fact->'sourceNoteIds') as value
        loop
          if not source_note_id = any(note_ids) then
            raise exception using errcode = '22023', message = 'Confirmed fact source is not in this revision';
          end if;
        end loop;

        reporting_staff_member_ids := array[]::uuid[];
        for reporting_staff_member_id in
          select value::text::uuid
          from jsonb_array_elements_text(fact->'reportingStaffMemberIds') as value
        loop
          reporting_staff_member_ids := array_append(
            reporting_staff_member_ids,
            reporting_staff_member_id
          );
        end loop;
      exception when invalid_text_representation then
        raise exception using errcode = '22023', message = 'Invalid confirmed fact';
      end;

      if cardinality(reporting_staff_member_ids) <>
        cardinality(array(select distinct unnest(reporting_staff_member_ids))) then
        raise exception using errcode = '22023', message = 'Duplicate reporting officer fact scope';
      end if;
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

create function app_private.validate_incident_fact_reporting_scopes(
  p_reviewed_facts jsonb,
  p_staff_relationships jsonb
)
returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  fact jsonb;
  reporting_staff_member_id uuid;
begin
  for fact in
    select value
    from jsonb_array_elements(p_reviewed_facts) as reviewed(value)
    where value->>'state' = 'confirmed'
  loop
    for reporting_staff_member_id in
      select value::text::uuid
      from jsonb_array_elements_text(fact->'reportingStaffMemberIds') as value
    loop
      if not exists (
        select 1
        from jsonb_array_elements(p_staff_relationships) as relationship(value)
        where relationship.value->>'relationship' = 'reporting_officer'
          and (relationship.value->>'staffMemberId')::uuid = reporting_staff_member_id
      ) then
        raise exception using errcode = '22023', message = 'Invalid incident fact reporting scopes';
      end if;
    end loop;
  end loop;
exception when invalid_text_representation then
  raise exception using errcode = '22023', message = 'Invalid incident fact reporting scopes';
end;
$$;

comment on function app_private.validate_incident_fact_reporting_scopes(jsonb, jsonb) is
  'Requires every confirmed-fact reporting scope to name a reporting officer selected on the same revision.';

revoke all on function app_private.validate_incident_fact_reporting_scopes(jsonb, jsonb)
  from public, anon, authenticated, service_role;

alter function api.create_incident(
  uuid, text, text, timestamptz, text, integer, jsonb, jsonb, jsonb, text, text
) set schema app_private;

alter function app_private.create_incident(
  uuid, text, text, timestamptz, text, integer, jsonb, jsonb, jsonb, text, text
) rename to create_incident_scoped_core;

revoke all on function app_private.create_incident_scoped_core(
  uuid, text, text, timestamptz, text, integer, jsonb, jsonb, jsonb, text, text
) from public, anon, authenticated, service_role;

create function api.create_incident(
  p_facility_id uuid,
  p_incident_number text,
  p_display_name text,
  p_occurred_at timestamptz,
  p_category text,
  p_schema_version integer,
  p_field_notes jsonb,
  p_reviewed_facts jsonb,
  p_staff_relationships jsonb,
  p_idempotency_key_digest text,
  p_request_digest text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app_private.validate_incident_create_payload(
    p_incident_number,
    p_display_name,
    p_occurred_at,
    p_category,
    p_schema_version,
    p_field_notes,
    p_reviewed_facts
  );
  perform app_private.validate_incident_fact_reporting_scopes(
    p_reviewed_facts,
    p_staff_relationships
  );

  return app_private.create_incident_scoped_core(
    p_facility_id,
    p_incident_number,
    p_display_name,
    p_occurred_at,
    p_category,
    p_schema_version,
    p_field_notes,
    p_reviewed_facts,
    p_staff_relationships,
    p_idempotency_key_digest,
    p_request_digest
  );
end;
$$;

comment on function api.create_incident(
  uuid, text, text, timestamptz, text, integer, jsonb, jsonb, jsonb, text, text
) is
  'Creates incident revision one with validated reporting/preparing attribution and officer-scoped confirmed facts.';

revoke all on function api.create_incident(
  uuid, text, text, timestamptz, text, integer, jsonb, jsonb, jsonb, text, text
) from public, anon, service_role;
grant execute on function api.create_incident(
  uuid, text, text, timestamptz, text, integer, jsonb, jsonb, jsonb, text, text
) to authenticated;

alter function api.store_report_draft_candidate(
  uuid, uuid, uuid, text, uuid[], jsonb, text, text, text
) set schema app_private;

alter function app_private.store_report_draft_candidate(
  uuid, uuid, uuid, text, uuid[], jsonb, text, text, text
) rename to store_report_draft_candidate_scoped_core;

revoke all on function app_private.store_report_draft_candidate_scoped_core(
  uuid, uuid, uuid, text, uuid[], jsonb, text, text, text
) from public, anon, authenticated, service_role;

create function api.store_report_draft_candidate(
  p_incident_id uuid,
  p_source_incident_revision_id uuid,
  p_reporting_staff_member_id uuid,
  p_report_type text,
  p_source_fact_ids uuid[],
  p_paragraphs jsonb,
  p_provider_key text,
  p_idempotency_key_digest text,
  p_request_digest text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from unnest(p_source_fact_ids) as requested(fact_id)
    where not exists (
      select 1
      from app_private.incident_revisions as revision
      cross join lateral jsonb_array_elements(revision.reviewed_facts) as fact(value)
      where revision.id = p_source_incident_revision_id
        and revision.incident_id = p_incident_id
        and revision.schema_version = 2
        and fact.value->>'state' = 'confirmed'
        and (fact.value->>'id')::uuid = requested.fact_id
        and jsonb_typeof(fact.value->'reportingStaffMemberIds') = 'array'
        and exists (
          select 1
          from jsonb_array_elements_text(
            fact.value->'reportingStaffMemberIds'
          ) as reporting(value)
          where reporting.value::uuid = p_reporting_staff_member_id
        )
    )
  ) then
    raise exception using errcode = '42501', message = 'Not authorized to use one or more report facts';
  end if;

  return app_private.store_report_draft_candidate_scoped_core(
    p_incident_id,
    p_source_incident_revision_id,
    p_reporting_staff_member_id,
    p_report_type,
    p_source_fact_ids,
    p_paragraphs,
    p_provider_key,
    p_idempotency_key_digest,
    p_request_digest
  );
end;
$$;

comment on function api.store_report_draft_candidate(
  uuid, uuid, uuid, text, uuid[], jsonb, text, text, text
) is
  'Stores a review-only candidate only when every source fact is explicitly scoped to its selected reporting officer.';

revoke all on function api.store_report_draft_candidate(
  uuid, uuid, uuid, text, uuid[], jsonb, text, text, text
) from public, anon, service_role;
grant execute on function api.store_report_draft_candidate(
  uuid, uuid, uuid, text, uuid[], jsonb, text, text, text
) to authenticated;

commit;
