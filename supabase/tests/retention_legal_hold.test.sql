begin;

select plan(20);

select has_table('app_private', 'legal_holds', 'private legal holds exist');
select has_column(
  'app_private',
  'incidents',
  'deletion_eligible_at',
  'incidents have a two-year deletion-review date'
);
select has_column(
  'app_private',
  'reports',
  'deletion_eligible_at',
  'reports have a two-year deletion-review date'
);
select has_column(
  'app_private',
  'paperwork_records',
  'deletion_eligible_at',
  'paperwork has a two-year deletion-review date'
);
select ok(
  (
    select relation.relrowsecurity and relation.relforcerowsecurity
    from pg_class as relation
    where relation.oid = 'app_private.legal_holds'::regclass
  ),
  'legal holds force row-level security'
);
select ok(
  not has_table_privilege('authenticated', 'app_private.legal_holds', 'select')
    and not has_table_privilege('service_role', 'app_private.legal_holds', 'select'),
  'Data API roles cannot read legal holds directly'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'app_private.place_legal_hold(uuid,uuid,text,uuid,text)',
    'execute'
  )
    and not has_function_privilege(
      'service_role',
      'app_private.release_legal_hold(uuid,uuid,text)',
      'execute'
    ),
  'Data API roles cannot invoke private hold mutations'
);

insert into auth.users (id, email)
values (
  '91919191-9191-4191-8191-919191919191',
  'retention-admin@example.invalid'
);

insert into app_private.staff_members (
  id,
  facility_id,
  employee_lookup_hash,
  employee_number_hint,
  display_name,
  status
)
select
  '92929292-9292-4292-8292-929292929292',
  facility.id,
  repeat('9', 64),
  '91',
  'Fictional Retention Admin',
  'active'
from app_private.facilities as facility
limit 1;

insert into app_private.user_accounts (
  auth_user_id,
  staff_member_id,
  sign_in_alias,
  role,
  status,
  must_change_passcode
)
values (
  '91919191-9191-4191-8191-919191919191',
  '92929292-9292-4292-8292-929292929292',
  'retention-admin-alias@example.invalid',
  'administrator',
  'active',
  false
);

insert into app_private.incidents (
  id,
  facility_id,
  created_by_account_id,
  incident_number,
  display_name,
  status,
  occurred_at,
  category,
  archived_at
)
select
  '93939393-9393-4393-8393-939393939393',
  facility.id,
  '91919191-9191-4191-8191-919191919191',
  'FICTIONAL-RETENTION-1',
  'Fictional archived incident',
  'archived',
  timestamptz '2023-12-31 12:00:00+00',
  'fictional',
  timestamptz '2024-01-01 12:00:00+00'
from app_private.facilities as facility
limit 1;

insert into app_private.reports (
  id,
  incident_id,
  report_type,
  reporting_account_id,
  prepared_by_account_id,
  status,
  archived_at
)
values (
  '94949494-9494-4494-8494-949494949494',
  '93939393-9393-4393-8393-939393939393',
  'fictional-retention-report',
  '91919191-9191-4191-8191-919191919191',
  '91919191-9191-4191-8191-919191919191',
  'archived',
  timestamptz '2024-01-02 12:00:00+00'
);

insert into app_private.paperwork_records (
  id,
  facility_id,
  kind,
  work_date,
  shift_code,
  created_by_account_id,
  archived_at
)
select
  '95959595-9595-4595-8595-959595959595',
  facility.id,
  'count_sheet',
  date '2023-12-31',
  'A',
  '91919191-9191-4191-8191-919191919191',
  timestamptz '2024-01-03 12:00:00+00'
from app_private.facilities as facility
limit 1;

select is(
  (
    select deletion_eligible_at
    from app_private.incidents
    where id = '93939393-9393-4393-8393-939393939393'
  ),
  timestamptz '2025-12-31 12:00:00+00',
  'incident deletion review starts exactly 730 days after archive'
);

select is(
  (
    select count(*)::integer
    from app_private.record_retention_status(timestamptz '2026-01-10 00:00:00+00')
    where record_id in (
      '93939393-9393-4393-8393-939393939393',
      '94949494-9494-4494-8494-949494949494',
      '95959595-9595-4595-8595-959595959595'
    )
  ),
  3,
  'retention status includes all archived fictional operational records'
);

select is(
  (
    select count(*)::integer
    from app_private.record_retention_status(timestamptz '2026-01-10 00:00:00+00')
    where record_id in (
      '93939393-9393-4393-8393-939393939393',
      '94949494-9494-4494-8494-949494949494',
      '95959595-9595-4595-8595-959595959595'
    ) and deletion_ready
  ),
  3,
  'eligible archived records are classified without deleting them'
);

select lives_ok(
  $$
    select set_config(
      'app.test.hold_id',
      app_private.place_legal_hold(
        '91919191-9191-4191-8191-919191919191',
        (select id from app_private.facilities limit 1),
        'facility',
        (select id from app_private.facilities limit 1),
        'FICTIONAL-HOLD-001'
      )::text,
      true
    )
  $$,
  'an active administrator can place a same-facility hold'
);

select is(
  (
    select count(*)::integer
    from app_private.record_retention_status(timestamptz '2026-01-10 00:00:00+00')
    where record_id in (
      '93939393-9393-4393-8393-939393939393',
      '94949494-9494-4494-8494-949494949494',
      '95959595-9595-4595-8595-959595959595'
    ) and active_legal_hold
  ),
  3,
  'a facility hold protects every archived operational record in scope'
);

select is(
  (
    select count(*)::integer
    from app_private.record_retention_status(timestamptz '2026-01-10 00:00:00+00')
    where record_id in (
      '93939393-9393-4393-8393-939393939393',
      '94949494-9494-4494-8494-949494949494',
      '95959595-9595-4595-8595-959595959595'
    ) and deletion_ready
  ),
  0,
  'an active hold overrides ordinary deletion eligibility'
);

select throws_ok(
  $$
    insert into app_private.legal_holds (
      facility_id, scope_type, scope_id, authority_reference, created_by_account_id
    ) values (
      (select id from app_private.facilities limit 1),
      'incident',
      '96969696-9696-4696-8696-969696969696',
      'FICTIONAL-HOLD-MISSING',
      '91919191-9191-4191-8191-919191919191'
    )
  $$,
  'Legal hold target does not belong to the facility',
  'a hold cannot target a missing or cross-facility record'
);

select lives_ok(
  $$
    select app_private.release_legal_hold(
      '91919191-9191-4191-8191-919191919191',
      current_setting('app.test.hold_id')::uuid,
      'FICTIONAL-RELEASE-001'
    )
  $$,
  'an active same-facility administrator can release a hold'
);

select is(
  (
    select count(*)::integer
    from app_private.record_retention_status(timestamptz '2026-01-10 00:00:00+00')
    where record_id in (
      '93939393-9393-4393-8393-939393939393',
      '94949494-9494-4494-8494-949494949494',
      '95959595-9595-4595-8595-959595959595'
    ) and active_legal_hold
  ),
  0,
  'a released hold no longer blocks the classified records'
);

select throws_ok(
  $$
    update app_private.legal_holds
    set authority_reference = 'FICTIONAL-ALTERED-HOLD'
    where id = current_setting('app.test.hold_id')::uuid
  $$,
  'A released legal hold is immutable',
  'released legal-hold evidence cannot be altered'
);

select throws_ok(
  $$
    delete from app_private.legal_holds
    where id = current_setting('app.test.hold_id')::uuid
  $$,
  'Rows in app_private.legal_holds are append-only',
  'legal-hold evidence cannot be directly deleted'
);

select is(
  (
    select count(*)::integer
    from app_private.audit_events
    where target_id = current_setting('app.test.hold_id')::uuid
      and event_type in (
        'retention.legal_hold.placed',
        'retention.legal_hold.released'
      )
  ),
  2,
  'hold placement and release create allowlisted audit evidence'
);

select is(
  (
    select count(*)::integer
    from app_private.audit_events
    where target_id = current_setting('app.test.hold_id')::uuid
      and metadata ? 'authority_reference'
  ),
  0,
  'hold authority references are not copied into audit metadata'
);

select * from finish();
rollback;
