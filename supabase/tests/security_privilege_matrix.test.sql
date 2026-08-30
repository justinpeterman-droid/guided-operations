begin;

select plan(10);

select ok(
  not has_schema_privilege('anon', 'app_private', 'usage'),
  'anon cannot use the private application schema'
);

select ok(
  not has_schema_privilege('authenticated', 'app_private', 'usage'),
  'authenticated cannot use the private application schema directly'
);

select ok(
  not has_schema_privilege('service_role', 'app_private', 'usage'),
  'the elevated Data API role cannot use the private application schema'
);

select ok(
  (select bool_and(
    not has_table_privilege('anon', c.oid, 'select')
    and not has_table_privilege('anon', c.oid, 'insert')
    and not has_table_privilege('anon', c.oid, 'update')
    and not has_table_privilege('anon', c.oid, 'delete')
  )
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'app_private' and c.relkind = 'r'),
  'anon has no direct CRUD privilege on private application tables'
);

select ok(
  (select bool_and(
    not has_table_privilege('authenticated', c.oid, 'select')
    and not has_table_privilege('authenticated', c.oid, 'insert')
    and not has_table_privilege('authenticated', c.oid, 'update')
    and not has_table_privilege('authenticated', c.oid, 'delete')
  )
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'app_private' and c.relkind = 'r'),
  'authenticated has no direct CRUD privilege on private application tables'
);

select ok(
  (select bool_and(not has_function_privilege('anon', p.oid, 'execute'))
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'api' and p.prosecdef),
  'anon cannot execute exposed SECURITY DEFINER API functions'
);

select ok(
  (select bool_and(not has_function_privilege('anon', p.oid, 'execute'))
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'app_private' and p.prosecdef),
  'anon cannot execute private SECURITY DEFINER functions'
);

select ok(
  (select bool_and(not has_function_privilege('authenticated', p.oid, 'execute'))
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'app_private' and p.prosecdef),
  'authenticated cannot execute private SECURITY DEFINER functions directly'
);

select ok(
  (select bool_and(not has_function_privilege('service_role', p.oid, 'execute'))
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('api', 'app_private') and p.prosecdef),
  'the elevated Data API role cannot execute application SECURITY DEFINER functions'
);

select ok(
  (select bool_and('search_path=""' = any(coalesce(p.proconfig, array[]::text[])))
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('api', 'app_private') and p.prosecdef),
  'all application SECURITY DEFINER functions pin an empty search_path'
);

select * from finish();
rollback;
