begin;

select plan(4);

set local role service_role;

select throws_ok(
  $$ select * from app_private.user_accounts limit 1 $$,
  '42501',
  'permission denied for schema app_private',
  'the elevated Data API role cannot read private application tables'
);

select throws_ok(
  $$ select * from app_private.audit_events limit 1 $$,
  '42501',
  'permission denied for schema app_private',
  'the elevated Data API role cannot read private audit records'
);

select throws_ok(
  $$ select * from api.current_account() $$,
  '42501',
  'permission denied for schema api',
  'the elevated Data API role cannot call the session-bound user API'
);

select throws_ok(
  $$ select * from api.list_admin_accounts(10) $$,
  '42501',
  'permission denied for schema api',
  'the elevated Data API role cannot call administrator APIs'
);

reset role;

select * from finish();
rollback;
