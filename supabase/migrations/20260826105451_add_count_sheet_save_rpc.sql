begin;

create or replace function app_private.calculate_count_sheet_validation(
  p_structure jsonb,
  p_payload jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  columns text[];
  areas text[];
  operational_fields text[];
  column_name text;
  area_name text;
  field_name text;
  raw_value text;
  count_value integer;
  row_total integer;
  housing_total integer := 0;
  operational_total integer := 0;
  row_totals jsonb := '{}'::jsonb;
  out_of_housing jsonb := '{}'::jsonb;
  unit_totals jsonb := '{}'::jsonb;
begin
  if jsonb_typeof(p_structure) <> 'object'
    or jsonb_typeof(p_payload) <> 'object'
    or p_structure->>'schema_version' <> '1'
    or p_payload->>'schema_version' <> '1'
    or char_length(coalesce(p_structure->>'title', '')) not between 1 and 200
    or jsonb_typeof(p_structure->'columns') <> 'array'
    or jsonb_typeof(p_structure->'areas') <> 'array'
    or jsonb_typeof(p_structure->'operational_fields') <> 'array'
    or jsonb_typeof(p_structure->'attachment_reminders') <> 'array'
    or jsonb_typeof(p_payload->'cells') <> 'object'
    or jsonb_typeof(p_payload->'in_housing') <> 'object'
    or jsonb_typeof(p_payload->'operational') <> 'object' then
    raise exception using errcode = '22023', message = 'Invalid Count Sheet values';
  end if;

  select array_agg(value order by ordinality)
    into columns
    from jsonb_array_elements_text(p_structure->'columns') with ordinality;
  select array_agg(value order by ordinality)
    into areas
    from jsonb_array_elements_text(p_structure->'areas') with ordinality;
  select array_agg(value order by ordinality)
    into operational_fields
    from jsonb_array_elements_text(p_structure->'operational_fields') with ordinality;

  if coalesce(array_length(columns, 1), 0) not between 1 and 64
    or coalesce(array_length(areas, 1), 0) not between 1 and 64
    or coalesce(array_length(operational_fields, 1), 0) not between 1 and 64
    or exists (select 1 from unnest(columns) as item where char_length(item) not between 1 and 160)
    or exists (select 1 from unnest(areas) as item where char_length(item) not between 1 and 160)
    or exists (select 1 from unnest(operational_fields) as item where char_length(item) not between 1 and 160)
    or (select count(*) from unnest(columns) as item) <> (select count(distinct item) from unnest(columns) as item)
    or (select count(*) from unnest(areas) as item) <> (select count(distinct item) from unnest(areas) as item)
    or (select count(*) from unnest(operational_fields) as item) <> (select count(distinct item) from unnest(operational_fields) as item) then
    raise exception using errcode = '22023', message = 'Invalid Count Sheet structure';
  end if;

  if exists (
    select 1
    from jsonb_array_elements_text(p_structure->'attachment_reminders') as reminder
    where reminder <> all(operational_fields)
       or char_length(reminder) not between 1 and 160
  ) then
    raise exception using errcode = '22023', message = 'Invalid Count Sheet structure';
  end if;

  if (select array_agg(key order by key) from jsonb_object_keys(p_payload->'cells') as key)
      is distinct from (select array_agg(item order by item) from unnest(areas) as item)
    or (select array_agg(key order by key) from jsonb_object_keys(p_payload->'in_housing') as key)
      is distinct from (select array_agg(item order by item) from unnest(columns) as item)
    or (select array_agg(key order by key) from jsonb_object_keys(p_payload->'operational') as key)
      is distinct from (select array_agg(item order by item) from unnest(operational_fields) as item) then
    raise exception using errcode = '22023', message = 'Count Sheet values do not match the approved structure';
  end if;

  foreach area_name in array areas loop
    if jsonb_typeof(p_payload->'cells'->area_name) <> 'object'
      or (select array_agg(key order by key) from jsonb_object_keys(p_payload->'cells'->area_name) as key)
        is distinct from (select array_agg(item order by item) from unnest(columns) as item) then
      raise exception using errcode = '22023', message = 'Count Sheet values do not match the approved structure';
    end if;
  end loop;

  foreach area_name in array areas loop
    row_total := 0;
    foreach column_name in array columns loop
      raw_value := p_payload #>> array['cells', area_name, column_name];
      if raw_value is not null and raw_value !~ '^[0-9]{1,5}$' then
        raise exception using errcode = '22023', message = 'Count Sheet values must be nonnegative whole numbers';
      end if;
      count_value := coalesce(raw_value::integer, 0);
      row_total := row_total + count_value;
      out_of_housing := jsonb_set(
        out_of_housing,
        array[column_name],
        to_jsonb(coalesce((out_of_housing->>column_name)::integer, 0) + count_value),
        true
      );
    end loop;
    row_totals := jsonb_set(row_totals, array[area_name], to_jsonb(row_total), true);
  end loop;

  foreach column_name in array columns loop
    raw_value := p_payload #>> array['in_housing', column_name];
    if raw_value is not null and raw_value !~ '^[0-9]{1,5}$' then
      raise exception using errcode = '22023', message = 'Count Sheet values must be nonnegative whole numbers';
    end if;
    count_value := coalesce(raw_value::integer, 0);
    count_value := coalesce((out_of_housing->>column_name)::integer, 0) + count_value;
    unit_totals := jsonb_set(unit_totals, array[column_name], to_jsonb(count_value), true);
    housing_total := housing_total + count_value;
  end loop;

  foreach field_name in array operational_fields loop
    raw_value := p_payload #>> array['operational', field_name];
    if raw_value is not null and raw_value !~ '^[0-9]{1,5}$' then
      raise exception using errcode = '22023', message = 'Count Sheet values must be nonnegative whole numbers';
    end if;
    operational_total := operational_total + coalesce(raw_value::integer, 0);
  end loop;

  return jsonb_build_object(
    'row_totals', row_totals,
    'out_of_housing', out_of_housing,
    'unit_totals', unit_totals,
    'column_totals', unit_totals,
    'housing_total', housing_total,
    'operational_total', operational_total,
    'difference', housing_total - operational_total,
    'reconciled', housing_total = operational_total
  );
end;
$$;

comment on function app_private.calculate_count_sheet_validation(jsonb, jsonb) is
  'Validates a closed Count Sheet shape and derives reconciliation totals from entered values; client-provided totals are never accepted.';

revoke all on function app_private.calculate_count_sheet_validation(jsonb, jsonb)
  from public, anon, authenticated, service_role;

create or replace function api.save_count_sheet(
  p_work_date date,
  p_base_revision_number integer,
  p_structure jsonb,
  p_payload jsonb,
  p_reason text,
  p_idempotency_key_digest text,
  p_request_digest text
)
returns table (record_id uuid, revision_number integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_facility_id uuid;
  actor_shift_code text;
  record app_private.paperwork_records%rowtype;
  calculated_validation jsonb;
  prior_request_digest text;
  prior_result_id uuid;
  prior_result_code text;
  next_revision_number integer;
begin
  if p_work_date is null
    or p_base_revision_number < 0
    or char_length(coalesce(p_reason, '')) not between 1 and 500
    or p_idempotency_key_digest !~ '^[a-f0-9]{64}$'
    or p_request_digest !~ '^[a-f0-9]{64}$' then
    raise exception using errcode = '22023', message = 'Invalid Count Sheet save request';
  end if;

  select staff.facility_id, staff.shift_code
    into actor_facility_id, actor_shift_code
    from app_private.user_accounts as account
    join app_private.staff_members as staff on staff.id = account.staff_member_id
    where account.auth_user_id = auth.uid()
      and account.status = 'active'
      and staff.status = 'active';

  if not found or actor_shift_code is null then
    raise exception using errcode = '42501', message = 'Not authorized to save this Count Sheet';
  end if;

  select request_digest, result_reference_id, result_code
    into prior_request_digest, prior_result_id, prior_result_code
    from app_private.idempotency_records
    where actor_account_id = auth.uid()
      and action = 'count_sheet.save'
      and idempotency_key_digest = p_idempotency_key_digest
    for update;

  if found then
    if prior_request_digest <> p_request_digest then
      raise exception using errcode = '22023', message = 'Retry key was reused for a different request';
    end if;
    if prior_result_id is not null and prior_result_code ~ '^count_sheet\.saved\.r[0-9]+$' then
      return query select prior_result_id, substring(prior_result_code from '\.r([0-9]+)$')::integer;
      return;
    end if;
    raise exception using errcode = '40001', message = 'Count Sheet save is already in progress';
  end if;

  calculated_validation := app_private.calculate_count_sheet_validation(p_structure, p_payload);

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      actor_facility_id::text || ':' || p_work_date::text || ':' || actor_shift_code,
      0
    )
  );

  select *
    into record
    from app_private.paperwork_records as candidate
    where candidate.facility_id = actor_facility_id
      and candidate.kind = 'count_sheet'
      and candidate.work_date = p_work_date
      and candidate.shift_code = actor_shift_code
      and candidate.archived_at is null
    for update;

  if not found then
    if p_base_revision_number <> 0 then
      raise exception using errcode = '40001', message = 'Count Sheet revision conflict';
    end if;
    insert into app_private.paperwork_records (
      facility_id, kind, work_date, shift_code, created_by_account_id
    ) values (
      actor_facility_id, 'count_sheet', p_work_date, actor_shift_code, auth.uid()
    )
    returning * into record;
  elsif p_base_revision_number <> record.current_revision_number then
    raise exception using errcode = '40001', message = 'Count Sheet revision conflict';
  end if;

  insert into app_private.idempotency_records (
    actor_account_id, action, idempotency_key_digest, request_digest, expires_at
  ) values (
    auth.uid(),
    'count_sheet.save',
    p_idempotency_key_digest,
    p_request_digest,
    statement_timestamp() + interval '24 hours'
  );

  next_revision_number := record.current_revision_number + 1;
  insert into app_private.paperwork_revisions (
    paperwork_record_id, revision_number, editor_account_id, reason,
    structure, payload, validation, provenance
  ) values (
    record.id,
    next_revision_number,
    auth.uid(),
    p_reason,
    p_structure,
    p_payload,
    calculated_validation,
    jsonb_build_object('prior_revision_number', record.current_revision_number)
  );

  update app_private.idempotency_records
    set status = 'succeeded',
        result_reference_id = record.id,
        result_code = 'count_sheet.saved.r' || next_revision_number::text
    where actor_account_id = auth.uid()
      and action = 'count_sheet.save'
      and idempotency_key_digest = p_idempotency_key_digest;

  return query select record.id, next_revision_number;
end;
$$;

comment on function api.save_count_sheet(date, integer, jsonb, jsonb, text, text, text) is
  'Creates or appends one active shift-shared Count Sheet revision with current-account, idempotency, concurrency, and server-derived reconciliation controls.';

revoke all on function api.save_count_sheet(date, integer, jsonb, jsonb, text, text, text)
  from public, anon, service_role;
grant usage on schema api to authenticated;
grant execute on function api.save_count_sheet(date, integer, jsonb, jsonb, text, text, text)
  to authenticated;

commit;
