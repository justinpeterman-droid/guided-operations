begin;

set local search_path = extensions, public;

select plan(6);

select ok(
  exists (
    select 1
    from pg_proc as procedure
    join pg_namespace as namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'api'
      and procedure.prosecdef
      and has_function_privilege('authenticated', procedure.oid, 'execute')
  ),
  'the reviewed authenticated security-definer API surface is not empty'
);

select is(
  (
    select count(*)::integer
    from pg_proc as procedure
    join pg_namespace as namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'api'
      and procedure.prosecdef
      and has_function_privilege('authenticated', procedure.oid, 'execute')
      and not (
        coalesce(procedure.proconfig, '{}'::text[])
          @> array['search_path=""']::text[]
      )
  ),
  0,
  'every authenticated security-definer API routine has an empty search path'
);

select is(
  (
    select count(*)::integer
    from pg_proc as procedure
    join pg_namespace as namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'api'
      and procedure.prosecdef
      and has_function_privilege('authenticated', procedure.oid, 'execute')
      and has_function_privilege('anon', procedure.oid, 'execute')
  ),
  0,
  'anonymous callers cannot execute the reviewed security-definer API surface'
);

select is(
  (
    select count(*)::integer
    from pg_proc as procedure
    join pg_namespace as namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'api'
      and procedure.prosecdef
      and has_function_privilege('authenticated', procedure.oid, 'execute')
      and has_function_privilege('service_role', procedure.oid, 'execute')
  ),
  0,
  'the elevated Data API role cannot execute the reviewed user API surface'
);

select is(
  (
    select count(*)::integer
    from pg_proc as procedure
    join pg_namespace as namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'app_private'
      and procedure.prosecdef
      and has_function_privilege('authenticated', procedure.oid, 'execute')
  ),
  0,
  'authenticated callers cannot execute private security-definer helpers directly'
);

select is(
  (
    select count(*)::integer
    from (
      select lower(pg_get_functiondef(procedure.oid)) as definition
      from pg_proc as procedure
      join pg_namespace as namespace on namespace.oid = procedure.pronamespace
      where namespace.nspname = 'api'
        and procedure.prosecdef
        and has_function_privilege('authenticated', procedure.oid, 'execute')
    ) as reviewed_routine
    where position('auth.uid()' in reviewed_routine.definition) = 0
      and position('app_private.can_access_incident' in reviewed_routine.definition) = 0
      and position('app_private.current_policy_facility_id' in reviewed_routine.definition) = 0
      and position('app_private.create_incident_scoped_core' in reviewed_routine.definition) = 0
      and position('app_private.store_report_draft_candidate_scoped_core' in reviewed_routine.definition) = 0
      and position('app_private.current_daily_paperwork_admin_facility_id' in reviewed_routine.definition) = 0
      and position('api.retrieve_policy_passages_v2' in reviewed_routine.definition) = 0
      and position('api.list_daily_paperwork_status_v2' in reviewed_routine.definition) = 0
      and position('api.get_daily_paperwork_template_v2' in reviewed_routine.definition) = 0
  ),
  0,
  'every reviewed security-definer API routine has an approved session-authorization anchor'
);

select * from finish();

rollback;
