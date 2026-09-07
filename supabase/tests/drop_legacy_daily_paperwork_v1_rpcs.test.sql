begin;

select plan(6);

-- Negative coverage: the superseded v1 Daily Paperwork RPCs no longer exist
-- in the catalog at all, under any signature, for any role.

select ok(
  to_regprocedure('api.list_daily_paperwork_status(date,text)') is null,
  'api.list_daily_paperwork_status(date,text) no longer exists'
);

select ok(
  to_regprocedure('api.get_daily_paperwork_template(uuid,date)') is null,
  'api.get_daily_paperwork_template(uuid,date) no longer exists'
);

select is(
  (
    select count(*)::integer
    from pg_proc as procedure
    join pg_namespace as namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'api'
      and procedure.proname in (
        'list_daily_paperwork_status',
        'get_daily_paperwork_template'
      )
  ),
  0,
  'no function named list_daily_paperwork_status or get_daily_paperwork_template survives under any signature'
);

-- Defense against a silent revert: the _v2 wrappers must resolve the actor's
-- facility through the strong, auth_version-checked anchor rather than
-- reintroducing an inline, weaker lookup.

select ok(
  position(
    'app_private.current_daily_paperwork_admin_facility_id'
    in lower(pg_get_functiondef('api.list_daily_paperwork_status_v2(date,text)'::regprocedure))
  ) > 0,
  'api.list_daily_paperwork_status_v2 still anchors on the session-authority helper'
);

select ok(
  position(
    'app_private.current_daily_paperwork_admin_facility_id'
    in lower(pg_get_functiondef('api.get_daily_paperwork_template_v2(uuid,date)'::regprocedure))
  ) > 0,
  'api.get_daily_paperwork_template_v2 still anchors on the session-authority helper'
);

-- Positive coverage: the inlined _v2 functions still serve an authorized,
-- current-session administrator end to end.

insert into auth.users (id, email)
values (
  '75000000-0000-4000-8000-000000000001',
  'fictional-drop-legacy-admin@example.invalid'
);

insert into app_private.staff_members (
  id,
  facility_id,
  employee_lookup_hash,
  employee_number_hint,
  display_name,
  status,
  shift_code
)
select
  '76000000-0000-4000-8000-000000000001',
  facility.id,
  repeat('9', 64),
  'DL1',
  'Fictional Drop-Legacy Administrator',
  'active',
  'A'
from app_private.facilities as facility;

insert into app_private.user_accounts (
  auth_user_id,
  staff_member_id,
  sign_in_alias,
  role,
  status,
  must_change_passcode
) values (
  '75000000-0000-4000-8000-000000000001',
  '76000000-0000-4000-8000-000000000001',
  'fictional-drop-legacy-admin-auth@example.invalid',
  'administrator',
  'active',
  false
);

insert into app_private.form_templates (
  id,
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
  approved_by_account_id
)
select
  '77000000-0000-4000-8000-000000000001',
  facility.id,
  'assignment_roster',
  'Fictional Drop-Legacy Assignment Roster',
  1,
  'Fictional Records Owner',
  'FICTIONAL-DROP-LEGACY-V1',
  repeat('8', 64),
  'approved_internal_use',
  'landscape',
  array['screen', 'print']::text[],
  '{"schema_version":1,"fictional_drop_legacy_definition":true}'::jsonb,
  '{"schema_version":1,"fields":[{"key":"supervisor_note","label":"Fictional supervisor note","type":"text","required":false,"max_length":200}],"tables":[]}'::jsonb,
  date '2026-01-01',
  timestamptz '2026-01-01T00:00:00Z',
  (
    select account.auth_user_id
    from app_private.user_accounts as account
    where account.auth_user_id = '75000000-0000-4000-8000-000000000001'
  )
from app_private.facilities as facility;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '75000000-0000-4000-8000-000000000001',
  true
);
select set_config(
  'request.jwt.claims',
  '{"app_metadata":{"auth_version":1}}',
  true
);

select is(
  (
    select count(*)::integer
    from api.list_daily_paperwork_status_v2(date '2026-08-27', 'A')
    where configured
  ),
  1,
  'the inlined v2 catalog still surfaces the one approved fictional template for a current-session administrator'
);

reset role;

select * from finish();
rollback;
