begin;

create function app_private.valid_daily_paperwork_field_definition(
  p_definition jsonb
)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  field_type text;
  option_count integer;
begin
  if jsonb_typeof(p_definition) is distinct from 'object'
    or exists (
      select 1
      from jsonb_object_keys(p_definition) as key
      where key not in (
        'key', 'label', 'type', 'required', 'help_text',
        'max_length', 'minimum', 'maximum', 'options'
      )
    )
    or coalesce(p_definition->>'key', '') !~ '^[a-z][a-z0-9_]{0,63}$'
    or char_length(coalesce(p_definition->>'label', '')) not between 1 and 160
    or jsonb_typeof(p_definition->'required') is distinct from 'boolean'
    or (
      p_definition ? 'help_text'
      and (
        jsonb_typeof(p_definition->'help_text') is distinct from 'string'
        or char_length(p_definition->>'help_text') not between 1 and 500
      )
    ) then
    return false;
  end if;

  field_type := p_definition->>'type';
  if field_type = 'text' then
    return p_definition ? 'max_length'
      and jsonb_typeof(p_definition->'max_length') = 'number'
      and (p_definition->>'max_length') ~ '^[1-9][0-9]{0,3}$'
      and (p_definition->>'max_length')::integer between 1 and 4000
      and not (p_definition ?| array['minimum', 'maximum', 'options']);
  elsif field_type = 'integer' then
    return p_definition ? 'minimum'
      and p_definition ? 'maximum'
      and jsonb_typeof(p_definition->'minimum') = 'number'
      and jsonb_typeof(p_definition->'maximum') = 'number'
      and (p_definition->>'minimum') ~ '^-?(0|[1-9][0-9]{0,6})$'
      and (p_definition->>'maximum') ~ '^-?(0|[1-9][0-9]{0,6})$'
      and (p_definition->>'minimum')::integer between -1000000 and 1000000
      and (p_definition->>'maximum')::integer between -1000000 and 1000000
      and (p_definition->>'minimum')::integer <= (p_definition->>'maximum')::integer
      and not (p_definition ?| array['max_length', 'options']);
  elsif field_type = 'select' then
    if jsonb_typeof(p_definition->'options') is distinct from 'array'
      or p_definition ?| array['max_length', 'minimum', 'maximum'] then
      return false;
    end if;
    option_count := jsonb_array_length(p_definition->'options');
    return option_count between 1 and 100
      and not exists (
        select 1
        from jsonb_array_elements(p_definition->'options') as option
        where jsonb_typeof(option) is distinct from 'string'
          or char_length(option #>> '{}') not between 1 and 160
      )
      and option_count = (
        select count(distinct option #>> '{}')
        from jsonb_array_elements(p_definition->'options') as option
      );
  elsif field_type in ('boolean', 'date', 'time') then
    return not (p_definition ?| array['max_length', 'minimum', 'maximum', 'options']);
  end if;

  return false;
exception
  when invalid_text_representation or numeric_value_out_of_range then
    return false;
end;
$$;

comment on function app_private.valid_daily_paperwork_field_definition(jsonb) is
  'Validates one bounded field definition for the private template-driven Daily Paperwork engine.';

revoke all on function app_private.valid_daily_paperwork_field_definition(jsonb)
  from public, anon, authenticated, service_role;

create function app_private.valid_daily_paperwork_field_schema(
  p_schema jsonb
)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  field_count integer;
  table_count integer;
  table_definition jsonb;
  column_count integer;
begin
  if jsonb_typeof(p_schema) is distinct from 'object'
    or p_schema->>'schema_version' is distinct from '1'
    or jsonb_typeof(p_schema->'fields') is distinct from 'array'
    or jsonb_typeof(p_schema->'tables') is distinct from 'array'
    or exists (
      select 1
      from jsonb_object_keys(p_schema) as key
      where key not in ('schema_version', 'fields', 'tables')
    ) then
    return false;
  end if;

  field_count := jsonb_array_length(p_schema->'fields');
  table_count := jsonb_array_length(p_schema->'tables');
  if field_count not between 0 and 256
    or table_count not between 0 and 32
    or field_count + table_count < 1
    or octet_length(p_schema::text) > 500000
    or exists (
      select 1
      from jsonb_array_elements(p_schema->'fields') as field
      where not app_private.valid_daily_paperwork_field_definition(field)
    )
    or field_count <> (
      select count(distinct field->>'key')
      from jsonb_array_elements(p_schema->'fields') as field
    ) then
    return false;
  end if;

  for table_definition in
    select value from jsonb_array_elements(p_schema->'tables')
  loop
    if jsonb_typeof(table_definition) is distinct from 'object'
      or exists (
        select 1
        from jsonb_object_keys(table_definition) as key
        where key not in (
          'key', 'label', 'help_text', 'min_rows', 'max_rows', 'columns'
        )
      )
      or coalesce(table_definition->>'key', '') !~ '^[a-z][a-z0-9_]{0,63}$'
      or char_length(coalesce(table_definition->>'label', '')) not between 1 and 160
      or (
        table_definition ? 'help_text'
        and (
          jsonb_typeof(table_definition->'help_text') is distinct from 'string'
          or char_length(table_definition->>'help_text') not between 1 and 500
        )
      )
      or jsonb_typeof(table_definition->'min_rows') is distinct from 'number'
      or jsonb_typeof(table_definition->'max_rows') is distinct from 'number'
      or coalesce(table_definition->>'min_rows', '') !~ '^(0|[1-9][0-9]{0,2})$'
      or coalesce(table_definition->>'max_rows', '') !~ '^(0|[1-9][0-9]{0,2})$'
      or (table_definition->>'min_rows')::integer < 0
      or (table_definition->>'max_rows')::integer > 500
      or (table_definition->>'min_rows')::integer > (table_definition->>'max_rows')::integer
      or jsonb_typeof(table_definition->'columns') is distinct from 'array' then
      return false;
    end if;

    column_count := jsonb_array_length(table_definition->'columns');
    if column_count not between 1 and 64
      or exists (
        select 1
        from jsonb_array_elements(table_definition->'columns') as field
        where not app_private.valid_daily_paperwork_field_definition(field)
      )
      or column_count <> (
        select count(distinct field->>'key')
        from jsonb_array_elements(table_definition->'columns') as field
      ) then
      return false;
    end if;
  end loop;

  return table_count = (
    select count(distinct table_item.value->>'key')
    from jsonb_array_elements(p_schema->'tables') as table_item(value)
  );
exception
  when invalid_text_representation or numeric_value_out_of_range then
    return false;
end;
$$;

comment on function app_private.valid_daily_paperwork_field_schema(jsonb) is
  'Validates the bounded flat-field and repeating-table contract used by approved Daily Paperwork definitions.';

revoke all on function app_private.valid_daily_paperwork_field_schema(jsonb)
  from public, anon, authenticated, service_role;

create function app_private.valid_daily_paperwork_value(
  p_definition jsonb,
  p_value jsonb
)
returns boolean
language plpgsql
stable
set search_path = ''
as $$
declare
  field_type text := p_definition->>'type';
  text_value text;
  integer_value integer;
begin
  if p_value is null or p_value = 'null'::jsonb then
    return not (p_definition->>'required')::boolean;
  end if;

  if field_type = 'text' then
    if jsonb_typeof(p_value) <> 'string' then return false; end if;
    text_value := p_value #>> '{}';
    return char_length(text_value) <= (p_definition->>'max_length')::integer
      and (
        not (p_definition->>'required')::boolean
        or char_length(btrim(text_value)) > 0
      );
  elsif field_type = 'integer' then
    if jsonb_typeof(p_value) <> 'number'
      or (p_value #>> '{}') !~ '^-?(0|[1-9][0-9]{0,6})$' then
      return false;
    end if;
    integer_value := (p_value #>> '{}')::integer;
    return integer_value between
      (p_definition->>'minimum')::integer
      and (p_definition->>'maximum')::integer;
  elsif field_type = 'boolean' then
    return jsonb_typeof(p_value) = 'boolean';
  elsif field_type = 'date' then
    if jsonb_typeof(p_value) <> 'string'
      or (p_value #>> '{}') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
      return false;
    end if;
    perform (p_value #>> '{}')::date;
    return true;
  elsif field_type = 'time' then
    return jsonb_typeof(p_value) = 'string'
      and (p_value #>> '{}') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$';
  elsif field_type = 'select' then
    return jsonb_typeof(p_value) = 'string'
      and exists (
        select 1
        from jsonb_array_elements_text(p_definition->'options') as option
        where option = p_value #>> '{}'
      );
  end if;

  return false;
exception
  when invalid_text_representation or numeric_value_out_of_range
    or datetime_field_overflow then
    return false;
end;
$$;

comment on function app_private.valid_daily_paperwork_value(jsonb, jsonb) is
  'Checks one Daily Paperwork value against its server-owned approved definition.';

revoke all on function app_private.valid_daily_paperwork_value(jsonb, jsonb)
  from public, anon, authenticated, service_role;

create function app_private.blank_daily_paperwork_payload(p_schema jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  field_values jsonb;
  table_values jsonb;
begin
  if app_private.valid_daily_paperwork_field_schema(p_schema) is distinct from true then
    raise exception using errcode = '22023', message = 'Invalid Daily Paperwork field schema';
  end if;

  select coalesce(jsonb_object_agg(field->>'key', 'null'::jsonb), '{}'::jsonb)
    into field_values
    from jsonb_array_elements(p_schema->'fields') as field;
  select coalesce(jsonb_object_agg(table_definition->>'key', '[]'::jsonb), '{}'::jsonb)
    into table_values
    from jsonb_array_elements(p_schema->'tables') as table_definition;

  return jsonb_build_object(
    'schema_version', 1,
    'fields', field_values,
    'tables', table_values
  );
end;
$$;

comment on function app_private.blank_daily_paperwork_payload(jsonb) is
  'Builds a closed blank value object from one approved Daily Paperwork field schema.';

revoke all on function app_private.blank_daily_paperwork_payload(jsonb)
  from public, anon, authenticated, service_role;

create function app_private.calculate_daily_paperwork_validation(
  p_schema jsonb,
  p_payload jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  field_definition jsonb;
  table_definition jsonb;
  row_value jsonb;
  column_definition jsonb;
  row_count integer;
  total_rows integer := 0;
begin
  if app_private.valid_daily_paperwork_field_schema(p_schema) is distinct from true
    or jsonb_typeof(p_payload) is distinct from 'object'
    or p_payload->>'schema_version' is distinct from '1'
    or jsonb_typeof(p_payload->'fields') is distinct from 'object'
    or jsonb_typeof(p_payload->'tables') is distinct from 'object'
    or exists (
      select 1
      from jsonb_object_keys(p_payload) as key
      where key not in ('schema_version', 'fields', 'tables')
    )
    or octet_length(p_payload::text) > 750000
    or (
      select array_agg(key order by key)
      from jsonb_object_keys(p_payload->'fields') as key
    ) is distinct from (
      select array_agg(field->>'key' order by field->>'key')
      from jsonb_array_elements(p_schema->'fields') as field
    )
    or (
      select array_agg(key order by key)
      from jsonb_object_keys(p_payload->'tables') as key
    ) is distinct from (
      select array_agg(table_item.value->>'key' order by table_item.value->>'key')
      from jsonb_array_elements(p_schema->'tables') as table_item(value)
    ) then
    raise exception using errcode = '22023', message = 'Invalid Daily Paperwork values';
  end if;

  for field_definition in
    select value from jsonb_array_elements(p_schema->'fields')
  loop
    if not app_private.valid_daily_paperwork_value(
      field_definition,
      p_payload->'fields'->(field_definition->>'key')
    ) then
      raise exception using errcode = '22023', message = 'Invalid Daily Paperwork values';
    end if;
  end loop;

  for table_definition in
    select value from jsonb_array_elements(p_schema->'tables')
  loop
    if jsonb_typeof(p_payload->'tables'->(table_definition->>'key')) is distinct from 'array' then
      raise exception using errcode = '22023', message = 'Invalid Daily Paperwork values';
    end if;
    row_count := jsonb_array_length(p_payload->'tables'->(table_definition->>'key'));
    if row_count not between
      (table_definition->>'min_rows')::integer
      and (table_definition->>'max_rows')::integer then
      raise exception using errcode = '22023', message = 'Invalid Daily Paperwork values';
    end if;
    total_rows := total_rows + row_count;

    for row_value in
      select value
      from jsonb_array_elements(p_payload->'tables'->(table_definition->>'key'))
    loop
      if jsonb_typeof(row_value) is distinct from 'object'
        or (
          select array_agg(key order by key)
          from jsonb_object_keys(row_value) as key
        ) is distinct from (
          select array_agg(column_item.value->>'key' order by column_item.value->>'key')
          from jsonb_array_elements(table_definition->'columns') as column_item(value)
        ) then
        raise exception using errcode = '22023', message = 'Invalid Daily Paperwork values';
      end if;
      for column_definition in
        select value from jsonb_array_elements(table_definition->'columns')
      loop
        if not app_private.valid_daily_paperwork_value(
          column_definition,
          row_value->(column_definition->>'key')
        ) then
          raise exception using errcode = '22023', message = 'Invalid Daily Paperwork values';
        end if;
      end loop;
    end loop;
  end loop;

  return jsonb_build_object(
    'schema_version', 1,
    'valid', true,
    'field_count', jsonb_array_length(p_schema->'fields'),
    'table_count', jsonb_array_length(p_schema->'tables'),
    'row_count', total_rows
  );
end;
$$;

comment on function app_private.calculate_daily_paperwork_validation(jsonb, jsonb) is
  'Validates a closed Daily Paperwork payload against the approved private schema and returns content-free validation counts.';

revoke all on function app_private.calculate_daily_paperwork_validation(jsonb, jsonb)
  from public, anon, authenticated, service_role;

create function app_private.validate_daily_paperwork_template_definition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if app_private.valid_daily_paperwork_field_schema(new.field_schema) is distinct from true
    or new.structure->>'schema_version' <> '1'
    or octet_length(new.structure::text) > 2000000 then
    raise exception using errcode = '22023', message = 'Invalid Daily Paperwork template definition';
  end if;
  return new;
end;
$$;

comment on function app_private.validate_daily_paperwork_template_definition() is
  'Rejects new Daily Paperwork template versions that cannot be safely rendered and validated.';

revoke all on function app_private.validate_daily_paperwork_template_definition()
  from public, anon, authenticated, service_role;

create trigger form_templates_validate_definition
before insert on app_private.form_templates
for each row execute function app_private.validate_daily_paperwork_template_definition();

create or replace function app_private.enforce_paperwork_template_binding()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  record_row app_private.paperwork_records%rowtype;
  template_row app_private.form_templates%rowtype;
  restored_from integer;
  source_revision app_private.paperwork_revisions%rowtype;
  calculated_validation jsonb;
begin
  select *
    into strict record_row
    from app_private.paperwork_records as record
    where record.id = new.paperwork_record_id;

  if record_row.kind = 'count_sheet' then
    if new.form_template_id is not null then
      raise exception using errcode = '22023', message = 'Count Sheet revisions cannot use a Daily Paperwork template';
    end if;
    return new;
  end if;

  if new.form_template_id is null then
    raise exception using errcode = '22023', message = 'Daily Paperwork revisions require an approved template version';
  end if;

  select *
    into strict template_row
    from app_private.form_templates as template
    where template.id = new.form_template_id;

  if template_row.facility_id <> record_row.facility_id
    or template_row.template_code <> record_row.kind
    or new.structure <> template_row.structure then
    raise exception using errcode = '22023', message = 'Daily Paperwork template does not match the record or revision';
  end if;

  if new.provenance ? 'restored_from_revision_number' then
    begin
      restored_from := (new.provenance->>'restored_from_revision_number')::integer;
    exception
      when invalid_text_representation or numeric_value_out_of_range then
        raise exception using errcode = '22023', message = 'Daily Paperwork restore provenance is invalid';
    end;
    if restored_from < 1 then
      raise exception using errcode = '22023', message = 'Daily Paperwork restore provenance is invalid';
    end if;
    select *
      into source_revision
      from app_private.paperwork_revisions as revision
      where revision.paperwork_record_id = record_row.id
        and revision.revision_number = restored_from;
    if not found
      or source_revision.form_template_id is distinct from new.form_template_id
      or source_revision.structure <> new.structure
      or source_revision.payload <> new.payload
      or source_revision.validation <> new.validation then
      raise exception using errcode = '22023', message = 'Daily Paperwork restore must copy one exact prior revision';
    end if;
    return new;
  end if;

  if template_row.rights_status <> 'approved_internal_use'
    or template_row.active_from > record_row.work_date
    or (
      template_row.active_until is not null
      and template_row.active_until < record_row.work_date
    )
    or exists (
      select 1
      from app_private.form_templates as successor
      where successor.facility_id = template_row.facility_id
        and successor.template_code = template_row.template_code
        and successor.version > template_row.version
        and successor.active_from <= record_row.work_date
    ) then
    raise exception using errcode = '22023', message = 'Daily Paperwork template does not match the record or revision';
  end if;

  calculated_validation := app_private.calculate_daily_paperwork_validation(
    template_row.field_schema,
    new.payload
  );
  if new.validation <> calculated_validation then
    raise exception using errcode = '22023', message = 'Daily Paperwork validation was not derived from the approved template';
  end if;

  return new;
end;
$$;

comment on function app_private.enforce_paperwork_template_binding() is
  'Binds new Daily Paperwork saves to the controlling approved template and permits restores only as exact immutable historical copies.';

create function api.get_daily_paperwork_v2(
  p_template_code text,
  p_work_date date,
  p_shift_code text
)
returns table (
  template_id uuid,
  controlling_template_id uuid,
  template_code text,
  title text,
  template_version integer,
  source_revision text,
  source_sha256 text,
  print_orientation text,
  capabilities text[],
  structure jsonb,
  field_schema jsonb,
  editable boolean,
  record_id uuid,
  current_revision_number integer,
  payload jsonb,
  validation jsonb,
  reason text,
  saved_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_facility_id uuid;
begin
  actor_facility_id := app_private.current_daily_paperwork_admin_facility_id();
  if actor_facility_id is null then return; end if;
  if p_template_code not in (
    'assignment_roster', 'uniform_inspection', 'metal_detector_test',
    'perimeter_check', 'random_search_log', 'detector_sign_out'
  ) or p_work_date is null or p_shift_code not in ('A', 'B', 'C', 'D', 'U', 'F') then
    raise exception using errcode = '22023', message = 'Invalid Daily Paperwork selection';
  end if;

  return query
    with controlling_candidate as (
      select candidate.*
      from app_private.form_templates as candidate
      where candidate.facility_id = actor_facility_id
        and candidate.template_code = p_template_code
        and candidate.active_from <= p_work_date
      order by candidate.version desc, candidate.id desc
      limit 1
    ),
    controlling as (
      select *
      from controlling_candidate
      where rights_status = 'approved_internal_use'
        and (active_until is null or active_until >= p_work_date)
    ),
    record_head as (
      select record.*, revision.id as revision_id, revision.form_template_id,
        revision.payload, revision.validation, revision.reason,
        revision.created_at as saved_at
      from app_private.paperwork_records as record
      join app_private.paperwork_revisions as revision
        on revision.paperwork_record_id = record.id
        and revision.revision_number = record.current_revision_number
      where record.facility_id = actor_facility_id
        and record.kind = p_template_code
        and record.work_date = p_work_date
        and record.shift_code = p_shift_code
        and record.archived_at is null
    ),
    display_template as (
      select template.*
      from app_private.form_templates as template
      join record_head on record_head.form_template_id = template.id
      union all
      select controlling.*
      from controlling
      where not exists (select 1 from record_head)
    )
    select
      display_template.id,
      controlling.id,
      display_template.template_code,
      display_template.title,
      display_template.version,
      display_template.source_revision,
      display_template.source_sha256,
      display_template.print_orientation,
      display_template.capabilities,
      display_template.structure,
      display_template.field_schema,
      controlling.id is not null
        and 'screen' = any(controlling.capabilities)
        and (
          record_head.id is null
          or record_head.form_template_id = controlling.id
        ),
      record_head.id,
      record_head.current_revision_number,
      coalesce(
        record_head.payload,
        app_private.blank_daily_paperwork_payload(display_template.field_schema)
      ),
      record_head.validation,
      record_head.reason,
      record_head.saved_at
    from display_template
    left join controlling on true
    left join record_head on true;
end;
$$;

comment on function api.get_daily_paperwork_v2(text, date, text) is
  'Returns one exact private Daily Paperwork head or blank controlling template to a current same-facility administrator.';

create function api.save_daily_paperwork_v2(
  p_template_code text,
  p_work_date date,
  p_shift_code text,
  p_base_revision_number integer,
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
  template_row app_private.form_templates%rowtype;
  record_row app_private.paperwork_records%rowtype;
  calculated_validation jsonb;
  prior_request_digest text;
  prior_result_id uuid;
  prior_result_code text;
  next_revision_number integer;
begin
  actor_facility_id := app_private.current_daily_paperwork_admin_facility_id();
  if actor_facility_id is null then
    raise exception using errcode = '42501', message = 'Not authorized to save Daily Paperwork';
  end if;
  if p_template_code not in (
    'assignment_roster', 'uniform_inspection', 'metal_detector_test',
    'perimeter_check', 'random_search_log', 'detector_sign_out'
  ) or p_work_date is null
    or p_shift_code not in ('A', 'B', 'C', 'D', 'U', 'F')
    or p_base_revision_number is null or p_base_revision_number < 0
    or char_length(coalesce(p_reason, '')) not between 1 and 500
    or p_idempotency_key_digest !~ '^[a-f0-9]{64}$'
    or p_request_digest !~ '^[a-f0-9]{64}$' then
    raise exception using errcode = '22023', message = 'Invalid Daily Paperwork save request';
  end if;

  select candidate.*
    into template_row
    from app_private.form_templates as candidate
    where candidate.facility_id = actor_facility_id
      and candidate.template_code = p_template_code
      and candidate.active_from <= p_work_date
    order by candidate.version desc, candidate.id desc
    limit 1;
  if not found
    or template_row.rights_status <> 'approved_internal_use'
    or not ('screen' = any(template_row.capabilities))
    or (template_row.active_until is not null and template_row.active_until < p_work_date) then
    raise exception using errcode = '22023', message = 'Daily Paperwork template is unavailable';
  end if;

  calculated_validation := app_private.calculate_daily_paperwork_validation(
    template_row.field_schema,
    p_payload
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      actor_facility_id::text || ':' || p_template_code || ':' ||
      p_work_date::text || ':' || p_shift_code,
      0
    )
  );

  select request_digest, result_reference_id, result_code
    into prior_request_digest, prior_result_id, prior_result_code
    from app_private.idempotency_records
    where actor_account_id = auth.uid()
      and action = 'daily_paperwork.save'
      and idempotency_key_digest = p_idempotency_key_digest
    for update;
  if found then
    if prior_request_digest <> p_request_digest then
      raise exception using errcode = '22023', message = 'Retry key was reused for a different request';
    end if;
    if prior_result_id is not null
      and prior_result_code ~ '^daily_paperwork\.saved\.r[1-9][0-9]*$' then
      return query
        select prior_result_id,
          substring(prior_result_code from '\.r([1-9][0-9]*)$')::integer;
      return;
    end if;
    raise exception using errcode = '40001', message = 'Daily Paperwork save is already in progress';
  end if;

  select candidate.*
    into record_row
    from app_private.paperwork_records as candidate
    where candidate.facility_id = actor_facility_id
      and candidate.kind = p_template_code
      and candidate.work_date = p_work_date
      and candidate.shift_code = p_shift_code
      and candidate.archived_at is null
    for update;

  if not found then
    if p_base_revision_number <> 0 then
      raise exception using errcode = '40001', message = 'Daily Paperwork revision conflict';
    end if;
    insert into app_private.paperwork_records (
      facility_id, kind, work_date, shift_code, created_by_account_id
    ) values (
      actor_facility_id, p_template_code, p_work_date, p_shift_code, auth.uid()
    ) returning * into record_row;
  elsif p_base_revision_number <> record_row.current_revision_number then
    raise exception using errcode = '40001', message = 'Daily Paperwork revision conflict';
  end if;

  insert into app_private.idempotency_records (
    actor_account_id, action, idempotency_key_digest, request_digest, expires_at
  ) values (
    auth.uid(), 'daily_paperwork.save', p_idempotency_key_digest,
    p_request_digest, statement_timestamp() + interval '24 hours'
  );

  next_revision_number := record_row.current_revision_number + 1;
  insert into app_private.paperwork_revisions (
    paperwork_record_id, revision_number, editor_account_id, reason,
    structure, payload, validation, provenance, form_template_id
  ) values (
    record_row.id, next_revision_number, auth.uid(), p_reason,
    template_row.structure, p_payload, calculated_validation,
    jsonb_build_object(
      'prior_revision_number', record_row.current_revision_number,
      'template_version', template_row.version
    ),
    template_row.id
  );

  update app_private.idempotency_records
    set status = 'succeeded',
        result_reference_id = record_row.id,
        result_code = 'daily_paperwork.saved.r' || next_revision_number::text
    where actor_account_id = auth.uid()
      and action = 'daily_paperwork.save'
      and idempotency_key_digest = p_idempotency_key_digest;

  return query select record_row.id, next_revision_number;
end;
$$;

comment on function api.save_daily_paperwork_v2(text, date, text, integer, jsonb, text, text, text) is
  'Creates or appends an administrator-only Daily Paperwork revision using only the server-selected controlling private template.';

create function api.list_daily_paperwork_revisions_v2(p_record_id uuid)
returns table (
  revision_number integer,
  reason text,
  template_version integer,
  source_revision text,
  created_at timestamptz,
  is_current boolean,
  restored_from_revision_number integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_facility_id uuid;
begin
  actor_facility_id := app_private.current_daily_paperwork_admin_facility_id();
  if actor_facility_id is null then return; end if;
  if p_record_id is null then
    raise exception using errcode = '22023', message = 'Invalid Daily Paperwork reference';
  end if;

  return query
    select revision.revision_number, revision.reason, template.version,
      template.source_revision, revision.created_at,
      revision.revision_number = record.current_revision_number,
      case
        when revision.provenance->>'restored_from_revision_number' ~ '^[1-9][0-9]*$'
        then (revision.provenance->>'restored_from_revision_number')::integer
        else null
      end
    from app_private.paperwork_records as record
    join app_private.paperwork_revisions as revision
      on revision.paperwork_record_id = record.id
    join app_private.form_templates as template
      on template.id = revision.form_template_id
    where record.id = p_record_id
      and record.facility_id = actor_facility_id
      and record.kind <> 'count_sheet'
      and record.archived_at is null
    order by revision.revision_number desc
    limit 100;
end;
$$;

comment on function api.list_daily_paperwork_revisions_v2(uuid) is
  'Returns content-free revision history for one same-facility Daily Paperwork record to a current administrator.';

create function api.get_daily_paperwork_revision_v2(
  p_record_id uuid,
  p_revision_number integer
)
returns table (
  record_id uuid,
  template_code text,
  work_date date,
  shift_code text,
  current_revision_number integer,
  revision_number integer,
  reason text,
  template_id uuid,
  template_version integer,
  source_revision text,
  source_sha256 text,
  print_orientation text,
  capabilities text[],
  structure jsonb,
  field_schema jsonb,
  payload jsonb,
  validation jsonb,
  restored_from_revision_number integer,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_facility_id uuid;
begin
  actor_facility_id := app_private.current_daily_paperwork_admin_facility_id();
  if actor_facility_id is null then return; end if;
  if p_record_id is null or p_revision_number is null or p_revision_number < 1 then
    raise exception using errcode = '22023', message = 'Invalid Daily Paperwork revision reference';
  end if;

  return query
    select record.id, record.kind, record.work_date, record.shift_code,
      record.current_revision_number, revision.revision_number, revision.reason,
      template.id, template.version, template.source_revision,
      template.source_sha256, template.print_orientation,
      template.capabilities, revision.structure, template.field_schema,
      revision.payload, revision.validation,
      case
        when revision.provenance->>'restored_from_revision_number' ~ '^[1-9][0-9]*$'
        then (revision.provenance->>'restored_from_revision_number')::integer
        else null
      end,
      revision.created_at
    from app_private.paperwork_records as record
    join app_private.paperwork_revisions as revision
      on revision.paperwork_record_id = record.id
    join app_private.form_templates as template
      on template.id = revision.form_template_id
    where record.id = p_record_id
      and record.facility_id = actor_facility_id
      and record.kind <> 'count_sheet'
      and record.archived_at is null
      and revision.revision_number = p_revision_number;
end;
$$;

comment on function api.get_daily_paperwork_revision_v2(uuid, integer) is
  'Returns one exact immutable Daily Paperwork revision and its historical private template to a current same-facility administrator.';

create function api.restore_daily_paperwork_revision_v2(
  p_record_id uuid,
  p_base_revision_number integer,
  p_restore_revision_number integer,
  p_reason text,
  p_idempotency_key_digest text,
  p_request_digest text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_facility_id uuid;
  record_row app_private.paperwork_records%rowtype;
  target_revision app_private.paperwork_revisions%rowtype;
  prior_request_digest text;
  prior_result_code text;
  next_revision_number integer;
begin
  actor_facility_id := app_private.current_daily_paperwork_admin_facility_id();
  if actor_facility_id is null then
    raise exception using errcode = '42501', message = 'Not authorized to restore Daily Paperwork';
  end if;
  if p_record_id is null
    or p_base_revision_number is null or p_base_revision_number < 1
    or p_restore_revision_number is null or p_restore_revision_number < 1
    or char_length(coalesce(p_reason, '')) not between 1 and 500
    or p_idempotency_key_digest !~ '^[a-f0-9]{64}$'
    or p_request_digest !~ '^[a-f0-9]{64}$' then
    raise exception using errcode = '22023', message = 'Invalid Daily Paperwork restore request';
  end if;

  select candidate.*
    into record_row
    from app_private.paperwork_records as candidate
    where candidate.id = p_record_id
      and candidate.facility_id = actor_facility_id
      and candidate.kind <> 'count_sheet'
      and candidate.archived_at is null
    for update;
  if not found then
    raise exception using errcode = '42501', message = 'Not authorized to restore Daily Paperwork';
  end if;
  if p_base_revision_number <> record_row.current_revision_number then
    raise exception using errcode = '40001', message = 'Daily Paperwork revision conflict';
  end if;

  select revision.*
    into target_revision
    from app_private.paperwork_revisions as revision
    where revision.paperwork_record_id = record_row.id
      and revision.revision_number = p_restore_revision_number;
  if not found then
    raise exception using errcode = '22023', message = 'Daily Paperwork revision is unavailable for restore';
  end if;

  select request_digest, result_code
    into prior_request_digest, prior_result_code
    from app_private.idempotency_records
    where actor_account_id = auth.uid()
      and action = 'daily_paperwork.restore'
      and idempotency_key_digest = p_idempotency_key_digest
    for update;
  if found then
    if prior_request_digest <> p_request_digest then
      raise exception using errcode = '22023', message = 'Retry key was reused for a different request';
    end if;
    if prior_result_code ~ '^daily_paperwork\.restored\.r[1-9][0-9]*$' then
      return substring(prior_result_code from '[1-9][0-9]*$')::integer;
    end if;
    raise exception using errcode = '40001', message = 'Daily Paperwork restore is already in progress';
  end if;

  insert into app_private.idempotency_records (
    actor_account_id, action, idempotency_key_digest, request_digest, expires_at
  ) values (
    auth.uid(), 'daily_paperwork.restore', p_idempotency_key_digest,
    p_request_digest, statement_timestamp() + interval '24 hours'
  );

  next_revision_number := record_row.current_revision_number + 1;
  insert into app_private.paperwork_revisions (
    paperwork_record_id, revision_number, editor_account_id, reason,
    structure, payload, validation, provenance, form_template_id
  ) values (
    record_row.id, next_revision_number, auth.uid(), p_reason,
    target_revision.structure, target_revision.payload,
    target_revision.validation,
    jsonb_build_object(
      'prior_revision_number', record_row.current_revision_number,
      'restored_from_revision_number', p_restore_revision_number
    ),
    target_revision.form_template_id
  );

  update app_private.idempotency_records
    set status = 'succeeded',
        result_reference_id = record_row.id,
        result_code = 'daily_paperwork.restored.r' || next_revision_number::text
    where actor_account_id = auth.uid()
      and action = 'daily_paperwork.restore'
      and idempotency_key_digest = p_idempotency_key_digest;

  return next_revision_number;
end;
$$;

comment on function api.restore_daily_paperwork_revision_v2(uuid, integer, integer, text, text, text) is
  'Appends an exact prior Daily Paperwork snapshot as a new immutable revision with current-admin, concurrency, and idempotency controls.';

create function api.record_daily_paperwork_print_v2(
  p_record_id uuid,
  p_revision_number integer,
  p_idempotency_key_digest text,
  p_request_digest text,
  p_request_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_facility_id uuid;
  record_row app_private.paperwork_records%rowtype;
  template_row app_private.form_templates%rowtype;
  prior_request_digest text;
  prior_result_id uuid;
  prior_result_code text;
  audit_event_id uuid;
begin
  actor_facility_id := app_private.current_daily_paperwork_admin_facility_id();
  if actor_facility_id is null then
    raise exception using errcode = '42501', message = 'Not authorized to print Daily Paperwork';
  end if;
  if p_record_id is null
    or p_revision_number is null or p_revision_number < 1
    or p_idempotency_key_digest !~ '^[a-f0-9]{64}$'
    or p_request_digest !~ '^[a-f0-9]{64}$'
    or p_request_id is null then
    raise exception using errcode = '22023', message = 'Invalid Daily Paperwork print request';
  end if;

  select candidate.*
    into record_row
    from app_private.paperwork_records as candidate
    where candidate.id = p_record_id
      and candidate.facility_id = actor_facility_id
      and candidate.kind <> 'count_sheet'
      and candidate.archived_at is null
    for update;
  if not found then
    raise exception using errcode = '42501', message = 'Not authorized to print Daily Paperwork';
  end if;
  if p_revision_number <> record_row.current_revision_number then
    raise exception using errcode = '40001', message = 'Daily Paperwork revision conflict';
  end if;

  select template.*
    into template_row
    from app_private.paperwork_revisions as revision
    join app_private.form_templates as template on template.id = revision.form_template_id
    where revision.paperwork_record_id = record_row.id
      and revision.revision_number = p_revision_number;
  if not found or not ('print' = any(template_row.capabilities)) then
    raise exception using errcode = '22023', message = 'Daily Paperwork is not approved for printing';
  end if;

  select request_digest, result_reference_id, result_code
    into prior_request_digest, prior_result_id, prior_result_code
    from app_private.idempotency_records
    where actor_account_id = auth.uid()
      and action = 'daily_paperwork.output.print'
      and idempotency_key_digest = p_idempotency_key_digest
    for update;
  if found then
    if prior_request_digest <> p_request_digest then
      raise exception using errcode = '22023', message = 'Retry key was reused for a different request';
    end if;
    if prior_result_id is not null
      and prior_result_code = 'daily_paperwork.print.request.recorded' then
      return prior_result_id;
    end if;
    raise exception using errcode = '40001', message = 'Daily Paperwork print audit is already in progress';
  end if;

  insert into app_private.idempotency_records (
    actor_account_id, action, idempotency_key_digest, request_digest, expires_at
  ) values (
    auth.uid(), 'daily_paperwork.output.print', p_idempotency_key_digest,
    p_request_digest, statement_timestamp() + interval '24 hours'
  );

  insert into app_private.audit_events (
    facility_id, actor_auth_user_id, event_type, target_type, target_id,
    request_id, metadata
  ) values (
    actor_facility_id, auth.uid(), 'daily_paperwork.print.requested',
    'paperwork_record', record_row.id, p_request_id,
    jsonb_build_object(
      'action', 'print',
      'kind', record_row.kind,
      'revision_number', p_revision_number,
      'template_version', template_row.version
    )
  ) returning event_id into audit_event_id;

  update app_private.idempotency_records
    set status = 'succeeded',
        result_reference_id = audit_event_id,
        result_code = 'daily_paperwork.print.request.recorded'
    where actor_account_id = auth.uid()
      and action = 'daily_paperwork.output.print'
      and idempotency_key_digest = p_idempotency_key_digest;

  return audit_event_id;
end;
$$;

comment on function api.record_daily_paperwork_print_v2(uuid, integer, text, text, uuid) is
  'Records a redacted idempotent audit before a current administrator prints the current saved Daily Paperwork revision.';

revoke all on function api.get_daily_paperwork_v2(text, date, text)
  from public, anon, service_role;
revoke all on function api.save_daily_paperwork_v2(text, date, text, integer, jsonb, text, text, text)
  from public, anon, service_role;
revoke all on function api.list_daily_paperwork_revisions_v2(uuid)
  from public, anon, service_role;
revoke all on function api.get_daily_paperwork_revision_v2(uuid, integer)
  from public, anon, service_role;
revoke all on function api.restore_daily_paperwork_revision_v2(uuid, integer, integer, text, text, text)
  from public, anon, service_role;
revoke all on function api.record_daily_paperwork_print_v2(uuid, integer, text, text, uuid)
  from public, anon, service_role;

grant usage on schema api to authenticated;
grant execute on function api.get_daily_paperwork_v2(text, date, text)
  to authenticated;
grant execute on function api.save_daily_paperwork_v2(text, date, text, integer, jsonb, text, text, text)
  to authenticated;
grant execute on function api.list_daily_paperwork_revisions_v2(uuid)
  to authenticated;
grant execute on function api.get_daily_paperwork_revision_v2(uuid, integer)
  to authenticated;
grant execute on function api.restore_daily_paperwork_revision_v2(uuid, integer, integer, text, text, text)
  to authenticated;
grant execute on function api.record_daily_paperwork_print_v2(uuid, integer, text, text, uuid)
  to authenticated;

commit;
