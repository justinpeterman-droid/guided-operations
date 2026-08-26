begin;

create function app_private.approved_count_sheet_structure()
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select '{
    "schema_version": 1,
    "title": "North Central Unit Count Sheet",
    "columns": ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "Iso", "Inf"],
    "areas": ["A/W Office", "Barber Shop I/M", "Boiler Room", "Bull Pen", "Capt. Office", "Chapel", "Chow Hall", "Commissary", "Construction", "Dog Kennel", "Domestics", "Field Utility", "Front Office", "Garage", "Gate Pass", "Gym", "Hall Porter", "Horsebarn", "I.P.O.", "Infirmary", "Iso. Porter", "Kitchen", "Laundry", "Lawn, Inside", "Library / Law Library", "Maint. Inside", "Maint. Outside", "Major''s Office", "Mental Health", "Mt. Home Crew", "Other", "Reg. Maint #1", "Reg. Maint #2", "Sally Port", "School", "Trail Crew", "Visitation", "W.W.T.P.", "Work Craft", "Yard (North)", "Yard (South)"],
    "operational_fields": ["on_site", "gate_pass", "transfers", "court", "hospital", "furlough", "other"],
    "attachment_reminders": ["court", "hospital", "furlough"]
  }'::jsonb
$$;

comment on function app_private.approved_count_sheet_structure() is
  'Returns the exact owner-approved Count Sheet structure enforced at the database boundary.';

revoke all on function app_private.approved_count_sheet_structure()
  from public, anon, authenticated, service_role;

create function app_private.blank_approved_count_sheet_payload()
returns jsonb
language sql
immutable
set search_path = ''
as $$
  with structure as (
    select app_private.approved_count_sheet_structure() as value
  ),
  blank_columns as (
    select jsonb_object_agg(column_name, 'null'::jsonb) as value
    from structure,
      jsonb_array_elements_text(structure.value->'columns') as columns(column_name)
  ),
  blank_cells as (
    select jsonb_object_agg(area_name, blank_columns.value) as value
    from structure,
      blank_columns,
      jsonb_array_elements_text(structure.value->'areas') as areas(area_name)
  ),
  blank_operational as (
    select jsonb_object_agg(field_name, 'null'::jsonb) as value
    from structure,
      jsonb_array_elements_text(structure.value->'operational_fields') as fields(field_name)
  )
  select jsonb_build_object(
    'schema_version', 1,
    'count_started', null,
    'count_ended', null,
    'cells', blank_cells.value,
    'in_housing', blank_columns.value,
    'operational', blank_operational.value
  )
  from blank_columns, blank_cells, blank_operational
$$;

comment on function app_private.blank_approved_count_sheet_payload() is
  'Builds a blank value payload matching the exact approved Count Sheet structure.';

revoke all on function app_private.blank_approved_count_sheet_payload()
  from public, anon, authenticated, service_role;

create function app_private.enforce_approved_count_sheet_structure()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  record_kind text;
begin
  select record.kind
    into record_kind
    from app_private.paperwork_records as record
    where record.id = new.paperwork_record_id;

  if record_kind = 'count_sheet'
    and new.structure <> app_private.approved_count_sheet_structure() then
    raise exception using
      errcode = '22023',
      message = 'Count Sheet structure is not the approved form';
  end if;
  return new;
end;
$$;

comment on function app_private.enforce_approved_count_sheet_structure() is
  'Rejects any Count Sheet revision whose structure differs from the exact approved form.';

revoke all on function app_private.enforce_approved_count_sheet_structure()
  from public, anon, authenticated, service_role;

create trigger paperwork_revisions_approved_count_sheet_structure
before insert on app_private.paperwork_revisions
for each row execute function app_private.enforce_approved_count_sheet_structure();

commit;
