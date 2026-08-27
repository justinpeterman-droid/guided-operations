begin;

select plan(15);

select ok(
  to_regprocedure('app_private.place_legal_hold(uuid,text,uuid,text)') is not null,
  'the admin workflow has a facility-derived placement routine'
);

select ok(
  to_regprocedure('app_private.list_legal_holds(uuid,boolean,integer)') is not null,
  'the admin workflow has a bounded private register routine'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'app_private.place_legal_hold(uuid,text,uuid,text)',
    'execute'
  )
    and not has_function_privilege(
      'service_role',
      'app_private.list_legal_holds(uuid,boolean,integer)',
      'execute'
    ),
  'Data API roles cannot invoke the legal-hold admin routines'
);

select lives_ok(
  $$
    insert into auth.users (id, email)
    values
      ('71717171-7171-4171-8171-717171717171', 'hold-workflow-admin@example.invalid'),
      ('72727272-7272-4272-8272-727272727272', 'hold-workflow-officer@example.invalid');

    select app_private.bootstrap_first_administrator(
      '71717171-7171-4171-8171-717171717171', repeat('7', 64), '71',
      'Fictional Hold Administrator', 'hold-admin-alias@example.invalid',
      statement_timestamp() + interval '30 minutes'
    );
    select app_private.activate_bootstrapped_administrator(
      '71717171-7171-4171-8171-717171717171'
    );

    insert into app_private.staff_members (
      id, facility_id, employee_lookup_hash, employee_number_hint, display_name, status
    )
    select
      '73737373-7373-4373-8373-737373737373', id, repeat('8', 64), '72',
      'Fictional Hold Officer', 'active'
    from app_private.facilities
    where singleton_key = 1;

    insert into app_private.user_accounts (
      auth_user_id, staff_member_id, sign_in_alias, role, status, must_change_passcode
    ) values (
      '72727272-7272-4272-8272-727272727272',
      '73737373-7373-4373-8373-737373737373',
      'hold-officer-alias@example.invalid', 'officer', 'active', false
    );

    insert into app_private.incidents (
      id, facility_id, created_by_account_id, incident_number, display_name,
      status, occurred_at, category
    )
    select
      '74747474-7474-4474-8474-747474747474', id,
      '71717171-7171-4171-8171-717171717171',
      'FICTIONAL-HOLD-WORKFLOW-1', 'Fictional legal hold workflow',
      'draft', timestamptz '2026-08-27 03:00:00+00', 'fictional'
    from app_private.facilities
    where singleton_key = 1;
  $$,
  'fictional administrator, officer, and target exist'
);

select lives_ok(
  $$
    insert into app_private.admin_step_ups (
      account_id, auth_version, session_id, purpose, token_digest, request_id, expires_at
    ) values
      (
        '71717171-7171-4171-8171-717171717171', 1,
        '75757575-7575-4575-8575-757575757575',
        'retention.place_legal_hold', repeat('a', 43),
        '76767676-7676-4676-8676-767676767676',
        statement_timestamp() + interval '5 minutes'
      ),
      (
        '71717171-7171-4171-8171-717171717171', 1,
        '75757575-7575-4575-8575-757575757575',
        'retention.release_legal_hold', repeat('b', 43),
        '77777777-7777-4777-8777-777777777777',
        statement_timestamp() + interval '5 minutes'
      );
  $$,
  'the database accepts only the new purpose-bound hold approvals'
);

select is(
  (
    select count(*)::integer
    from app_private.admin_step_ups
    where purpose in (
      'retention.place_legal_hold',
      'retention.release_legal_hold'
    )
  ),
  2,
  'placement and release approvals remain separate records'
);

select lives_ok(
  $$
    select set_config(
      'app.test.workflow_hold_id',
      app_private.place_legal_hold(
        '71717171-7171-4171-8171-717171717171',
        'incident',
        '74747474-7474-4474-8474-747474747474',
        'FICTIONAL-HOLD-WORKFLOW-001'
      )::text,
      true
    )
  $$,
  'a current administrator can place a target-validated hold without selecting a facility'
);

select is(
  (
    select hold.facility_id
    from app_private.legal_holds as hold
    where hold.id = current_setting('app.test.workflow_hold_id')::uuid
  ),
  (select id from app_private.facilities where singleton_key = 1),
  'placement derives the facility from the current administrator'
);

select is(
  (
    select count(*)::integer
    from app_private.list_legal_holds(
      '71717171-7171-4171-8171-717171717171', false, 100
    )
  ),
  1,
  'the active register returns the same-facility hold'
);

select is(
  (
    select authority_reference
    from app_private.list_legal_holds(
      '71717171-7171-4171-8171-717171717171', false, 100
    )
    where hold_id = current_setting('app.test.workflow_hold_id')::uuid
  ),
  'FICTIONAL-HOLD-WORKFLOW-001',
  'the register returns the bounded authority reference without a record body'
);

select throws_ok(
  $$
    select * from app_private.list_legal_holds(
      '71717171-7171-4171-8171-717171717171', false, 201
    )
  $$,
  'Legal hold list limit must be between 1 and 200',
  'the private register rejects unbounded reads'
);

select throws_ok(
  $$
    select * from app_private.list_legal_holds(
      '72727272-7272-4272-8272-727272727272', false, 100
    )
  $$,
  'Current active administrator required',
  'an officer cannot read the legal-hold register'
);

select lives_ok(
  $$
    select app_private.release_legal_hold(
      '71717171-7171-4171-8171-717171717171',
      current_setting('app.test.workflow_hold_id')::uuid,
      'FICTIONAL-RELEASE-WORKFLOW-001'
    )
  $$,
  'a current same-facility administrator can release the hold'
);

select is(
  (
    select count(*)::integer
    from app_private.list_legal_holds(
      '71717171-7171-4171-8171-717171717171', false, 100
    )
  ),
  0,
  'released holds leave the active register'
);

select is(
  (
    select count(*)::integer
    from app_private.list_legal_holds(
      '71717171-7171-4171-8171-717171717171', true, 100
    )
    where hold_id = current_setting('app.test.workflow_hold_id')::uuid
      and release_authority_reference = 'FICTIONAL-RELEASE-WORKFLOW-001'
  ),
  1,
  'released evidence remains immutable and visible in the full register'
);

select * from finish();
rollback;
