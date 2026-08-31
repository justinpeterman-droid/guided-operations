begin;

select plan(9);

select ok(
  exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260831111000'
  ),
  'incident-scoped reads are delivered by a forward migration'
);

select ok(
  to_regprocedure('api.get_incident_summary(uuid)') is not null
  and to_regprocedure('api.list_incident_reports(uuid)') is not null,
  'both exact incident read functions exist'
);

select ok(
  has_function_privilege(
    'authenticated',
    'api.get_incident_summary(uuid)',
    'execute'
  )
  and has_function_privilege(
    'authenticated',
    'api.list_incident_reports(uuid)',
    'execute'
  )
  and not has_function_privilege(
    'anon',
    'api.get_incident_summary(uuid)',
    'execute'
  )
  and not has_function_privilege(
    'service_role',
    'api.list_incident_reports(uuid)',
    'execute'
  ),
  'only authenticated sessions can invoke the scoped reads'
);

select lives_ok(
  $$
    insert into auth.users (id, email) values
      ('72000000-0000-4000-8000-000000000011', 'scoped-one@invalid.example'),
      ('72000000-0000-4000-8000-000000000012', 'scoped-two@invalid.example');

    insert into app_private.staff_members (
      id, facility_id, employee_lookup_hash, employee_number_hint,
      display_name, status
    )
    select
      fixture.id,
      facility.id,
      fixture.lookup_hash,
      fixture.hint,
      fixture.display_name,
      'active'
    from app_private.facilities as facility
    cross join (
      values
        (
          '72000000-0000-4000-8000-000000000021'::uuid,
          repeat('3', 64),
          'FICT-SR1',
          'Fictional Scoped Reader One'
        ),
        (
          '72000000-0000-4000-8000-000000000022'::uuid,
          repeat('4', 64),
          'FICT-SR2',
          'Fictional Scoped Reader Two'
        )
    ) as fixture(id, lookup_hash, hint, display_name);

    insert into app_private.user_accounts (
      auth_user_id, staff_member_id, sign_in_alias, role, status,
      must_change_passcode
    ) values
      (
        '72000000-0000-4000-8000-000000000011',
        '72000000-0000-4000-8000-000000000021',
        'scoped-one@accounts.invalid',
        'officer',
        'active',
        false
      ),
      (
        '72000000-0000-4000-8000-000000000012',
        '72000000-0000-4000-8000-000000000022',
        'scoped-two@accounts.invalid',
        'officer',
        'active',
        false
      );

    insert into app_private.incidents (
      id, facility_id, created_by_account_id, incident_number,
      display_name, status, occurred_at, category,
      current_revision_number
    )
    select
      '72000000-0000-4000-8000-000000000031',
      facility.id,
      '72000000-0000-4000-8000-000000000011',
      'F-SCOPED-SQL-001',
      'Fictional scoped SQL incident',
      'in_review',
      '2026-08-30T12:00:00Z'::timestamptz,
      'training',
      0
    from app_private.facilities as facility
    limit 1;

    insert into app_private.reports (
      id, incident_id, report_type, reporting_account_id,
      prepared_by_account_id, status, current_revision_number
    ) values (
      '72000000-0000-4000-8000-000000000041',
      '72000000-0000-4000-8000-000000000031',
      'first_person',
      '72000000-0000-4000-8000-000000000011',
      '72000000-0000-4000-8000-000000000011',
      'complete',
      1
    );

    insert into app_private.report_access (
      report_id, account_id, relationship, granted_by_account_id
    ) values (
      '72000000-0000-4000-8000-000000000041',
      '72000000-0000-4000-8000-000000000011',
      'owner',
      '72000000-0000-4000-8000-000000000011'
    );
  $$,
  'fictional incident and report fixtures can be created'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '72000000-0000-4000-8000-000000000011',
  true
);

select is(
  (
    select incident_number
    from api.get_incident_summary(
      '72000000-0000-4000-8000-000000000031'
    )
  ),
  'F-SCOPED-SQL-001',
  'the incident creator can load the exact incident summary'
);

select is(
  (
    select report_id
    from api.list_incident_reports(
      '72000000-0000-4000-8000-000000000031'
    )
  ),
  '72000000-0000-4000-8000-000000000041'::uuid,
  'the authorized account receives the exact incident report'
);

select set_config(
  'request.jwt.claim.sub',
  '72000000-0000-4000-8000-000000000012',
  true
);

select is(
  (
    select count(*)::integer
    from api.get_incident_summary(
      '72000000-0000-4000-8000-000000000031'
    )
  ),
  0,
  'an unrelated same-facility account cannot read the incident summary'
);

select is(
  (
    select count(*)::integer
    from api.list_incident_reports(
      '72000000-0000-4000-8000-000000000031'
    )
  ),
  0,
  'an unrelated account cannot enumerate reports through the scoped function'
);

select ok(
  position(
    'limit ' in lower(
      pg_get_functiondef('api.list_incident_reports(uuid)'::regprocedure)
    )
  ) = 0,
  'the per-incident report read is not truncated by a global row cap'
);

select * from finish();
rollback;
