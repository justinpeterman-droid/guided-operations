begin;

select plan(32);

select has_column('app_private', 'user_accounts', 'id', 'user_accounts has application id');
select has_table('app_private', 'user_credentials', 'credential table exists');
select has_table('app_private', 'user_sessions', 'session table exists');
select has_table('app_private', 'auth_rate_limits', 'rate-limit table exists');
select has_table('app_private', 'admin_step_ups', 'step-up table exists');

select ok(
  exists (select 1 from pg_roles where rolname = 'guided_operations_app'),
  'application login role exists'
);
select ok(
  exists (select 1 from pg_roles where rolname = 'guided_operations_preauth' and not rolbypassrls),
  'preauth role exists without BYPASSRLS'
);
select ok(
  exists (select 1 from pg_roles where rolname = 'guided_operations_runtime' and not rolbypassrls),
  'runtime role exists without BYPASSRLS'
);

select ok(
  (select relrowsecurity and relforcerowsecurity from pg_class where oid = 'app_private.user_credentials'::regclass),
  'credential table enables and forces RLS'
);
select ok(
  (select relrowsecurity and relforcerowsecurity from pg_class where oid = 'app_private.user_sessions'::regclass),
  'session table enables and forces RLS'
);
select ok(
  (select relrowsecurity and relforcerowsecurity from pg_class where oid = 'app_private.auth_rate_limits'::regclass),
  'rate-limit table enables and forces RLS'
);
select ok(
  (select relrowsecurity and relforcerowsecurity from pg_class where oid = 'app_private.admin_step_ups'::regclass),
  'step-up table enables and forces RLS'
);

select is(
  (select count(*)::integer from information_schema.table_privileges where grantee = 'guided_operations_preauth'),
  0,
  'preauth role has no direct table grants'
);
select is(
  (
    select count(*)::integer
    from information_schema.table_privileges
    where grantee in ('PUBLIC', 'anon', 'authenticated', 'service_role')
      and table_schema = 'app_private'
      and table_name in ('user_credentials', 'user_sessions', 'auth_rate_limits', 'admin_step_ups')
  ),
  0,
  'Data API roles have no direct opaque-auth table grants'
);
select is(
  (
    select count(*)::integer
    from information_schema.table_privileges
    where grantee = 'guided_operations_runtime'
      and table_schema = 'app_private'
  ),
  2,
  'runtime role has only the two reviewed safe-row table grants'
);
select is(
  (
    select count(*)::integer
    from information_schema.routine_privileges
    where grantee = 'guided_operations_preauth'
      and routine_schema = 'app_private'
  ),
  7,
  'preauth role can execute only seven reviewed functions'
);

select has_function('app_private', 'preauth_lookup_account', array['text'], 'preauth account lookup exists');
select has_function('app_private', 'preauth_resolve_session', array['uuid'], 'preauth session resolver exists');
select has_function(
  'app_private',
  'preauth_rate_limit',
  array['text', 'text', 'integer', 'integer', 'integer'],
  'preauth rate limiter exists'
);
select has_function('app_private', 'current_account_id', array[]::text[], 'request account context helper exists');
select has_function('app_private', 'current_account_is_active', array[]::text[], 'active-account helper exists');
select has_function('app_private', 'current_account_is_admin', array[]::text[], 'administrator helper exists');
select has_function('app_private', 'runtime_current_account', array[]::text[], 'safe current-account DTO exists');
select has_function(
  'app_private',
  'preauth_record_login_failure',
  array['uuid', 'integer', 'integer'],
  'login failure recorder exists'
);
select has_function(
  'app_private',
  'preauth_create_session',
  array['uuid', 'uuid', 'integer', 'text', 'text', 'text', 'timestamp with time zone', 'timestamp with time zone'],
  'session creator exists'
);
select has_function(
  'app_private',
  'preauth_refresh_session',
  array['uuid', 'text', 'text', 'timestamp with time zone'],
  'session refresh/rotation function exists'
);
select has_function(
  'app_private',
  'preauth_revoke_session',
  array['uuid', 'text', 'text'],
  'session revocation function exists'
);
select has_function(
  'app_private',
  'runtime_change_passcode',
  array['text', 'integer'],
  'runtime passcode change function exists'
);
select has_function(
  'app_private',
  'runtime_revoke_all_sessions',
  array['text'],
  'runtime logout-all function exists'
);

select is(
  (select count(*)::integer from app_private.user_accounts),
  0,
  'migration preserves verified zero-account foundation'
);

select is(
  (
    select count(*)::integer
    from pg_constraint
    where conrelid = 'app_private.user_sessions'::regclass
      and contype = 'u'
  ),
  1,
  'current session secret digest is unique'
);

select is(
  (
    select count(*)::integer
    from pg_constraint
    where conrelid = 'app_private.admin_step_ups'::regclass
      and contype = 'u'
  ),
  1,
  'step-up token digest is unique'
);

select * from finish();
rollback;
