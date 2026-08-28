begin;

alter table app_private.paperwork_records
  drop constraint paperwork_records_kind_check;

alter table app_private.paperwork_records
  add constraint paperwork_records_kind_check check (
    kind in (
      'count_sheet',
      'assignment_roster',
      'uniform_inspection',
      'metal_detector_test',
      'perimeter_check',
      'random_search_log',
      'detector_sign_out'
    )
  );

create or replace function app_private.valid_form_template_capabilities(
  p_capabilities text[]
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select
    cardinality(p_capabilities) between 1 and 3
    and p_capabilities <@ array['screen', 'print', 'pdf']::text[]
    and cardinality(p_capabilities) = (
      select count(distinct capability)
      from unnest(p_capabilities) as capability
    );
$$;

revoke all on function app_private.valid_form_template_capabilities(text[])
  from public, anon, authenticated, service_role;

create table app_private.form_templates (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null
    references app_private.facilities(id) on delete restrict,
  template_code text not null check (
    template_code in (
      'assignment_roster',
      'uniform_inspection',
      'metal_detector_test',
      'perimeter_check',
      'random_search_log',
      'detector_sign_out'
    )
  ),
  title text not null check (char_length(title) between 1 and 160),
  version integer not null check (version > 0),
  source_authority text not null
    check (char_length(source_authority) between 1 and 160),
  source_revision text not null
    check (char_length(source_revision) between 1 and 160),
  source_sha256 text not null check (source_sha256 ~ '^[a-f0-9]{64}$'),
  rights_status text not null check (
    rights_status in ('approved_internal_use', 'quarantined', 'retired')
  ),
  print_orientation text not null
    check (print_orientation in ('portrait', 'landscape')),
  capabilities text[] not null check (
    app_private.valid_form_template_capabilities(capabilities)
  ),
  structure jsonb not null check (jsonb_typeof(structure) = 'object'),
  field_schema jsonb not null check (jsonb_typeof(field_schema) = 'object'),
  active_from date not null,
  active_until date,
  approved_at timestamptz,
  approved_by_account_id uuid
    references app_private.user_accounts(auth_user_id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  unique (facility_id, template_code, version),
  constraint form_templates_active_range_check check (
    active_until is null or active_until >= active_from
  ),
  constraint form_templates_approval_check check (
    (
      rights_status = 'approved_internal_use'
      and approved_at is not null
      and approved_by_account_id is not null
    )
    or (
      rights_status <> 'approved_internal_use'
      and approved_at is null
      and approved_by_account_id is null
    )
  )
);

comment on table app_private.form_templates is
  'Append-only private source/version registry for approved operational form definitions. Source bodies and definitions never enter public schemas.';

create index form_templates_current_lookup_idx
  on app_private.form_templates (
    facility_id,
    template_code,
    rights_status,
    active_from desc,
    version desc
  );

create index form_templates_approver_idx
  on app_private.form_templates (approved_by_account_id)
  where approved_by_account_id is not null;

create trigger form_templates_immutable
before update or delete on app_private.form_templates
for each row execute function app_private.reject_mutation();

alter table app_private.form_templates enable row level security;
alter table app_private.form_templates force row level security;

revoke all on table app_private.form_templates
  from public, anon, authenticated, service_role;

alter table app_private.paperwork_revisions
  add column form_template_id uuid
    references app_private.form_templates(id) on delete restrict;

create index paperwork_revisions_form_template_idx
  on app_private.paperwork_revisions (form_template_id)
  where form_template_id is not null;

create or replace function app_private.enforce_paperwork_template_binding()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  record_row app_private.paperwork_records%rowtype;
  template_row app_private.form_templates%rowtype;
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
    or template_row.rights_status <> 'approved_internal_use'
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
    )
    or new.structure <> template_row.structure then
    raise exception using errcode = '22023', message = 'Daily Paperwork template does not match the record or revision';
  end if;

  return new;
end;
$$;

comment on function app_private.enforce_paperwork_template_binding() is
  'Binds every Daily Paperwork revision to one approved same-facility immutable template version and exact reviewed structure.';

revoke all on function app_private.enforce_paperwork_template_binding()
  from public, anon, authenticated, service_role;

create trigger paperwork_revisions_template_binding
before insert on app_private.paperwork_revisions
for each row execute function app_private.enforce_paperwork_template_binding();

create or replace function api.list_daily_paperwork_status(
  p_work_date date,
  p_shift_code text
)
returns table (
  template_code text,
  display_title text,
  configured boolean,
  template_id uuid,
  template_version integer,
  print_orientation text,
  capabilities text[],
  record_id uuid,
  current_revision_number integer,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_facility_id uuid;
begin
  if p_work_date is null
    or p_shift_code not in ('A', 'B', 'C', 'D', 'U', 'F') then
    raise exception using errcode = '22023', message = 'Invalid Daily Paperwork date or shift';
  end if;

  select staff.facility_id
    into actor_facility_id
    from app_private.user_accounts as account
    join app_private.staff_members as staff on staff.id = account.staff_member_id
    where account.auth_user_id = auth.uid()
      and account.role = 'administrator'
      and account.status = 'active'
      and not account.must_change_passcode
      and staff.status = 'active';

  if not found then
    return;
  end if;

  return query
    with catalog(template_code, display_title, sort_order) as (
      values
        ('assignment_roster'::text, 'Shift Assignment Roster'::text, 1),
        ('uniform_inspection', 'Uniform Inspection Log', 2),
        ('metal_detector_test', 'Walk-Through Metal Detector Test', 3),
        ('perimeter_check', 'Perimeter Check List', 4),
        ('random_search_log', 'Random Searches Log', 5),
        ('detector_sign_out', 'Handheld Metal Detector Sign-Out', 6)
    )
    select
      catalog.template_code,
      catalog.display_title,
      template.id is not null,
      template.id,
      template.version,
      template.print_orientation,
      coalesce(template.capabilities, '{}'::text[]),
      record.id,
      record.current_revision_number,
      record.updated_at
    from catalog
    left join lateral (
      select candidate.*
      from app_private.form_templates as candidate
      where candidate.facility_id = actor_facility_id
        and candidate.template_code = catalog.template_code
        and candidate.active_from <= p_work_date
      order by candidate.version desc, candidate.id desc
      limit 1
    ) as template on
      template.rights_status = 'approved_internal_use'
      and (
        template.active_until is null
        or template.active_until >= p_work_date
      )
    left join app_private.paperwork_records as record
      on record.facility_id = actor_facility_id
      and record.kind = catalog.template_code
      and record.work_date = p_work_date
      and record.shift_code = p_shift_code
      and record.archived_at is null
    order by catalog.sort_order;
end;
$$;

comment on function api.list_daily_paperwork_status(date, text) is
  'Returns the six Daily Paperwork availability/head summaries only to an active same-facility administrator. It returns no form body.';

create or replace function api.get_daily_paperwork_template(
  p_template_id uuid,
  p_work_date date
)
returns table (
  template_id uuid,
  template_code text,
  title text,
  version integer,
  source_revision text,
  source_sha256 text,
  print_orientation text,
  capabilities text[],
  structure jsonb,
  field_schema jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_facility_id uuid;
begin
  if p_template_id is null or p_work_date is null then
    raise exception using errcode = '22023', message = 'Invalid Daily Paperwork template reference';
  end if;

  select staff.facility_id
    into actor_facility_id
    from app_private.user_accounts as account
    join app_private.staff_members as staff on staff.id = account.staff_member_id
    where account.auth_user_id = auth.uid()
      and account.role = 'administrator'
      and account.status = 'active'
      and not account.must_change_passcode
      and staff.status = 'active';

  if not found then
    return;
  end if;

  return query
    select
      template.id,
      template.template_code,
      template.title,
      template.version,
      template.source_revision,
      template.source_sha256,
      template.print_orientation,
      template.capabilities,
      template.structure,
      template.field_schema
    from app_private.form_templates as template
    where template.id = p_template_id
      and template.facility_id = actor_facility_id
      and template.rights_status = 'approved_internal_use'
      and template.active_from <= p_work_date
      and (
        template.active_until is null
        or template.active_until >= p_work_date
      )
      and not exists (
        select 1
        from app_private.form_templates as successor
        where successor.facility_id = template.facility_id
          and successor.template_code = template.template_code
          and successor.version > template.version
          and successor.active_from <= p_work_date
      );
end;
$$;

comment on function api.get_daily_paperwork_template(uuid, date) is
  'Returns the controlling approved private Daily Paperwork template for one work date only to an active same-facility administrator.';

revoke all on function api.list_daily_paperwork_status(date, text)
  from public, anon, service_role;
revoke all on function api.get_daily_paperwork_template(uuid, date)
  from public, anon, service_role;

grant usage on schema api to authenticated;
grant execute on function api.list_daily_paperwork_status(date, text)
  to authenticated;
grant execute on function api.get_daily_paperwork_template(uuid, date)
  to authenticated;

commit;
