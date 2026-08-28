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
      'retention.approve_deletion',
      'retention.execute_deletion',
      'paperwork.template_import',
      'paperwork.template_rollback',
      'system.destructive_cleanup'
    )
  );

alter table app_private.admin_step_ups
  add column target_digest text check (
    target_digest is null or target_digest ~ '^[a-f0-9]{64}$'
  );

create function app_private.bind_admin_step_up_target(
  p_auth_user_id uuid,
  p_session_id uuid,
  p_auth_version integer,
  p_purpose text,
  p_request_id uuid,
  p_target_digest text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_purpose not in (
    'paperwork.template_import', 'paperwork.template_rollback'
  ) or p_target_digest !~ '^[a-f0-9]{64}$' then
    return false;
  end if;

  update app_private.admin_step_ups as step_up
  set target_digest = p_target_digest
  from app_private.user_accounts as account
  where step_up.account_id = p_auth_user_id
    and step_up.account_id = account.auth_user_id
    and step_up.session_id = p_session_id
    and step_up.auth_version = p_auth_version
    and step_up.auth_version = account.auth_version
    and step_up.purpose = p_purpose
    and step_up.request_id = p_request_id
    and step_up.expires_at > statement_timestamp()
    and step_up.consumed_at is null
    and step_up.target_digest is null
    and account.role = 'administrator'
    and account.status = 'active';
  return found;
end;
$$;

comment on function app_private.bind_admin_step_up_target(
  uuid, uuid, integer, text, uuid, text
) is
  'Binds one unconsumed Daily Paperwork administrator proof to the exact package digest reviewed before passcode confirmation.';

revoke all on function app_private.bind_admin_step_up_target(
  uuid, uuid, integer, text, uuid, text
) from public, anon, authenticated, service_role;

create table app_private.daily_paperwork_template_packages (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null
    references app_private.facilities(id) on delete restrict,
  package_digest text not null check (package_digest ~ '^[a-f0-9]{64}$'),
  mapping_version text not null check (
    mapping_version = 'daily-paperwork-source-to-form-v1'
  ),
  source_authority text not null check (
    char_length(source_authority) between 1 and 160
    and source_authority !~ '[[:cntrl:]<>]'
  ),
  source_revision text not null check (
    char_length(source_revision) between 1 and 160
    and source_revision !~ '[[:cntrl:]<>]'
  ),
  rights_status text not null check (rights_status = 'approved_internal_use'),
  active_from date not null,
  expected_previous_package_digest text check (
    expected_previous_package_digest is null
    or expected_previous_package_digest ~ '^[a-f0-9]{64}$'
  ),
  rollback_of_package_id uuid
    references app_private.daily_paperwork_template_packages(id)
    on delete restrict,
  source_count integer not null check (source_count = 6),
  total_source_bytes integer not null check (
    total_source_bytes between 12 and 1536000
  ),
  idempotency_key_digest text not null check (
    idempotency_key_digest ~ '^[a-f0-9]{64}$'
  ),
  approved_by_account_id uuid not null
    references app_private.user_accounts(auth_user_id) on delete restrict,
  approved_at timestamptz not null default statement_timestamp(),
  unique (facility_id, package_digest),
  unique (facility_id, idempotency_key_digest)
);

comment on table app_private.daily_paperwork_template_packages is
  'Append-only value-free approval and recovery manifest for one atomic six-definition Daily Paperwork package. Source bodies remain only in the linked private template rows.';

create index daily_paperwork_template_packages_current_idx
  on app_private.daily_paperwork_template_packages (
    facility_id, approved_at desc, id desc
  );

create trigger daily_paperwork_template_packages_immutable
before update or delete on app_private.daily_paperwork_template_packages
for each row execute function app_private.reject_mutation();

alter table app_private.daily_paperwork_template_packages
  enable row level security;
alter table app_private.daily_paperwork_template_packages
  force row level security;

revoke all on table app_private.daily_paperwork_template_packages
  from public, anon, authenticated, service_role;

do $$
declare
  trigger_name text := 'guided_operations_backup_freeze_' ||
    substr(md5('app_private.daily_paperwork_template_packages'), 1, 16);
begin
  execute format(
    'create trigger %I before insert or update or delete or truncate on app_private.daily_paperwork_template_packages for each statement execute function app_private.require_no_production_backup_write_freeze()',
    trigger_name
  );
end;
$$;

alter table app_private.form_templates
  add column package_id uuid
    references app_private.daily_paperwork_template_packages(id)
    on delete restrict,
  add column source_byte_length integer check (
    source_byte_length is null or source_byte_length between 2 and 256000
  ),
  add column mapped_sha256 text check (
    mapped_sha256 is null or mapped_sha256 ~ '^[a-f0-9]{64}$'
  );

create unique index form_templates_package_kind_idx
  on app_private.form_templates (package_id, template_code)
  where package_id is not null;

create function app_private.register_daily_paperwork_template_package(
  p_actor_auth_user_id uuid,
  p_session_id uuid,
  p_auth_version integer,
  p_step_up_token_digest text,
  p_step_up_request_id uuid,
  p_package_digest text,
  p_mapping_version text,
  p_source_authority text,
  p_source_revision text,
  p_active_from date,
  p_expected_current_package_digest text,
  p_rollback_of_package_digest text,
  p_idempotency_key_digest text,
  p_entries jsonb
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor_facility_id uuid;
  current_package_digest text;
  rollback_package_id uuid;
  package_id uuid;
  existing_package app_private.daily_paperwork_template_packages%rowtype;
  entry jsonb;
  next_version integer;
  inserted_count integer := 0;
  rollback_match_count integer;
  total_bytes integer;
  step_up_purpose text;
begin
  if p_actor_auth_user_id is null
    or p_session_id is null
    or p_auth_version is null
    or p_auth_version < 1
    or p_step_up_token_digest !~ '^[A-Za-z0-9_-]{40,}$'
    or p_step_up_request_id is null
    or p_package_digest !~ '^[a-f0-9]{64}$'
    or p_mapping_version <> 'daily-paperwork-source-to-form-v1'
    or char_length(coalesce(p_source_authority, '')) not between 1 and 160
    or p_source_authority ~ '[[:cntrl:]<>]'
    or char_length(coalesce(p_source_revision, '')) not between 1 and 160
    or p_source_revision ~ '[[:cntrl:]<>]'
    or p_active_from is null
    or (
      p_expected_current_package_digest is not null
      and p_expected_current_package_digest !~ '^[a-f0-9]{64}$'
    )
    or (
      p_rollback_of_package_digest is not null
      and p_rollback_of_package_digest !~ '^[a-f0-9]{64}$'
    )
    or p_idempotency_key_digest !~ '^[a-f0-9]{64}$'
    or jsonb_typeof(p_entries) is distinct from 'array'
    or jsonb_array_length(p_entries) <> 6 then
    raise exception using errcode = '22023',
      message = 'Invalid Daily Paperwork template package';
  end if;

  select staff.facility_id into actor_facility_id
  from app_private.user_accounts as account
  join app_private.staff_members as staff on staff.id = account.staff_member_id
  where account.auth_user_id = p_actor_auth_user_id
    and account.auth_version = p_auth_version
    and account.role = 'administrator'
    and account.status = 'active'
    and not account.must_change_passcode
    and staff.status = 'active';
  if not found then
    raise exception using errcode = '42501',
      message = 'Current active administrator required';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      actor_facility_id::text || ':daily-paperwork-template-package', 0
    )
  );

  select candidate.* into existing_package
  from app_private.daily_paperwork_template_packages as candidate
  where candidate.facility_id = actor_facility_id
    and candidate.idempotency_key_digest = p_idempotency_key_digest;
  if found then
    if existing_package.package_digest = p_package_digest
      and existing_package.mapping_version = p_mapping_version
      and existing_package.source_authority = p_source_authority
      and existing_package.source_revision = p_source_revision
      and existing_package.active_from = p_active_from then
      return existing_package.id;
    end if;
    raise exception using errcode = '23505',
      message = 'Daily Paperwork import idempotency key was reused';
  end if;

  select candidate.package_digest into current_package_digest
  from app_private.daily_paperwork_template_packages as candidate
  where candidate.facility_id = actor_facility_id
  order by candidate.approved_at desc, candidate.id desc
  limit 1;
  if p_expected_current_package_digest is distinct from current_package_digest then
    raise exception using errcode = '40001',
      message = 'Daily Paperwork template package changed';
  end if;

  if p_rollback_of_package_digest is not null then
    select candidate.id into rollback_package_id
    from app_private.daily_paperwork_template_packages as candidate
    where candidate.facility_id = actor_facility_id
      and candidate.package_digest = p_rollback_of_package_digest;
    if not found then
      raise exception using errcode = '22023',
        message = 'Daily Paperwork rollback source was not found';
    end if;
    step_up_purpose := 'paperwork.template_rollback';
  else
    step_up_purpose := 'paperwork.template_import';
  end if;

  if not exists (
    select 1
    from app_private.admin_step_ups as step_up
    where step_up.account_id = p_actor_auth_user_id
      and step_up.session_id = p_session_id
      and step_up.auth_version = p_auth_version
      and step_up.purpose = step_up_purpose
      and step_up.token_digest = p_step_up_token_digest
      and step_up.request_id = p_step_up_request_id
      and step_up.target_digest = p_package_digest
      and step_up.expires_at > statement_timestamp()
      and step_up.consumed_at is null
  ) then
    raise exception using errcode = '42501',
      message = 'Daily Paperwork approval does not match the package';
  end if;

  if app_private.consume_admin_step_up(
    p_actor_auth_user_id,
    p_session_id,
    p_auth_version,
    step_up_purpose,
    p_step_up_token_digest,
    p_step_up_request_id
  ) is distinct from true then
    raise exception using errcode = '42501',
      message = 'Fresh Daily Paperwork approval required';
  end if;

  if (
    select count(distinct item->>'kind')
    from jsonb_array_elements(p_entries) as source(item)
  ) <> 6
    or exists (
      select 1
      from jsonb_array_elements(p_entries) as source(item)
      where jsonb_typeof(item) is distinct from 'object'
        or not item ?& array[
          'kind', 'title', 'source_byte_length', 'source_sha256',
          'mapped_sha256', 'print_orientation', 'structure', 'field_schema'
        ]
        or exists (
          select 1 from jsonb_object_keys(item) as key
          where key not in (
            'kind', 'title', 'source_byte_length', 'source_sha256',
            'mapped_sha256', 'print_orientation', 'structure', 'field_schema'
          )
        )
        or item->>'kind' not in (
          'assignment_roster', 'uniform_inspection', 'metal_detector_test',
          'perimeter_check', 'random_search_log', 'detector_sign_out'
        )
        or char_length(coalesce(item->>'title', '')) not between 1 and 160
        or jsonb_typeof(item->'source_byte_length') is distinct from 'number'
        or (item->>'source_byte_length')::integer not between 2 and 256000
        or item->>'source_sha256' !~ '^[a-f0-9]{64}$'
        or item->>'mapped_sha256' !~ '^[a-f0-9]{64}$'
        or item->>'print_orientation' not in ('portrait', 'landscape')
        or jsonb_typeof(item->'structure') is distinct from 'object'
        or item->'structure'->>'schema_version' <> '1'
        or item->'structure'->>'mapping_version' <> p_mapping_version
        or item->'structure'->>'source_kind' <> item->>'kind'
        or octet_length((item->'structure')::text) > 2000000
        or app_private.valid_daily_paperwork_field_schema(
          item->'field_schema'
        ) is distinct from true
    ) then
    raise exception using errcode = '22023',
      message = 'Invalid Daily Paperwork template package entries';
  end if;

  if rollback_package_id is not null then
    select count(*)::integer into rollback_match_count
    from jsonb_array_elements(p_entries) as source(item)
    join app_private.form_templates as template
      on template.package_id = rollback_package_id
      and template.template_code = item->>'kind'
      and template.title = item->>'title'
      and template.source_byte_length =
        (item->>'source_byte_length')::integer
      and template.source_sha256 = item->>'source_sha256'
      and template.mapped_sha256 = item->>'mapped_sha256'
      and template.print_orientation = item->>'print_orientation'
      and template.structure = item->'structure'
      and template.field_schema = item->'field_schema';

    if rollback_match_count <> 6 then
      raise exception using errcode = '22023',
        message = 'Daily Paperwork rollback entries do not match the approved package';
    end if;
  end if;

  select sum((item->>'source_byte_length')::integer)::integer
    into total_bytes
  from jsonb_array_elements(p_entries) as source(item);

  insert into app_private.daily_paperwork_template_packages (
    facility_id,
    package_digest,
    mapping_version,
    source_authority,
    source_revision,
    rights_status,
    active_from,
    expected_previous_package_digest,
    rollback_of_package_id,
    source_count,
    total_source_bytes,
    idempotency_key_digest,
    approved_by_account_id
  ) values (
    actor_facility_id,
    p_package_digest,
    p_mapping_version,
    p_source_authority,
    p_source_revision,
    'approved_internal_use',
    p_active_from,
    p_expected_current_package_digest,
    rollback_package_id,
    6,
    total_bytes,
    p_idempotency_key_digest,
    p_actor_auth_user_id
  ) returning id into package_id;

  for entry in
    select item
    from jsonb_array_elements(p_entries) with ordinality as source(item, position)
    order by position
  loop
    select coalesce(max(template.version), 0) + 1 into next_version
    from app_private.form_templates as template
    where template.facility_id = actor_facility_id
      and template.template_code = entry->>'kind';

    insert into app_private.form_templates (
      facility_id,
      template_code,
      title,
      version,
      source_authority,
      source_revision,
      source_sha256,
      rights_status,
      print_orientation,
      capabilities,
      structure,
      field_schema,
      active_from,
      approved_at,
      approved_by_account_id,
      package_id,
      source_byte_length,
      mapped_sha256
    ) values (
      actor_facility_id,
      entry->>'kind',
      entry->>'title',
      next_version,
      p_source_authority,
      p_source_revision,
      entry->>'source_sha256',
      'approved_internal_use',
      entry->>'print_orientation',
      array['screen', 'print']::text[],
      entry->'structure',
      entry->'field_schema',
      p_active_from,
      statement_timestamp(),
      p_actor_auth_user_id,
      package_id,
      (entry->>'source_byte_length')::integer,
      entry->>'mapped_sha256'
    );
    inserted_count := inserted_count + 1;
  end loop;

  if inserted_count <> 6 then
    raise exception 'Daily Paperwork template package was not fully registered';
  end if;

  insert into app_private.audit_events (
    facility_id,
    actor_auth_user_id,
    event_type,
    target_type,
    target_id,
    metadata
  ) values (
    actor_facility_id,
    p_actor_auth_user_id,
    case when rollback_package_id is null
      then 'paperwork.template_package.imported'
      else 'paperwork.template_package.rolled_back'
    end,
    'daily_paperwork_template_package',
    package_id,
    jsonb_build_object(
      'package_digest', p_package_digest,
      'mapping_version', p_mapping_version,
      'source_count', 6,
      'rollback', rollback_package_id is not null
    )
  );

  return package_id;
end;
$$;

comment on function app_private.register_daily_paperwork_template_package(
  uuid, uuid, integer, text, uuid, text, text, text, text, date, text, text,
  text, jsonb
) is
  'Atomically consumes one purpose-bound administrator proof and appends one approved six-definition Daily Paperwork package with digest-bound source and mapped evidence.';

revoke all on function app_private.register_daily_paperwork_template_package(
  uuid, uuid, integer, text, uuid, text, text, text, text, date, text, text,
  text, jsonb
) from public, anon, authenticated, service_role;

commit;
