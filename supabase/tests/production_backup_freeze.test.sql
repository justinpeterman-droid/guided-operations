begin;

select plan(20);

select ok(
  exists (
    select 1 from supabase_migrations.schema_migrations
    where version = '20260827070000'
  ),
  'the backup freeze fix is delivered by a forward migration'
);

select has_table(
  'app_private',
  'production_backup_write_freeze',
  'the purpose-bound Production backup freeze exists'
);
select ok(
  to_regprocedure(
    'app_private.begin_production_backup_write_freeze(text,text,timestamp with time zone)'
  ) is not null
  and to_regprocedure(
    'app_private.assert_production_backup_write_freeze(text,integer)'
  ) is not null
  and to_regprocedure(
    'app_private.release_production_backup_write_freeze(text,integer)'
  ) is not null,
  'the freeze has acquire, verify, and release operations'
);
select ok(
  (
    select relation.relrowsecurity and relation.relforcerowsecurity
    from pg_class as relation
    where relation.oid =
      'app_private.production_backup_write_freeze'::regclass
  ),
  'the freeze table forces row-level security'
);
select ok(
  not has_table_privilege(
    'authenticated',
    'app_private.production_backup_write_freeze',
    'select'
  )
  and not has_function_privilege(
    'service_role',
    'app_private.begin_production_backup_write_freeze(text,text,timestamp with time zone)',
    'execute'
  ),
  'Data API roles cannot inspect or acquire the operator freeze'
);
select ok(
  exists (
    select 1
    from pg_trigger as table_trigger
    where table_trigger.tgrelid = 'app_private.user_accounts'::regclass
      and table_trigger.tgname like 'guided_operations_backup_freeze_%'
      and table_trigger.tgenabled in ('O', 'A')
  )
  and exists (
    select 1
    from pg_trigger as table_trigger
    where table_trigger.tgrelid = 'auth.users'::regclass
      and table_trigger.tgname like 'guided_operations_backup_freeze_%'
      and table_trigger.tgenabled in ('O', 'A')
  )
  and exists (
    select 1
    from pg_trigger as table_trigger
    where table_trigger.tgrelid = 'storage.objects'::regclass
      and table_trigger.tgname like 'guided_operations_backup_freeze_%'
      and table_trigger.tgenabled in ('O', 'A')
  ),
  'application, Auth, and Storage object writes share the freeze boundary'
);
select is(
  app_private.assert_production_backup_write_freeze(
    'backup-20260827T120000000Z-0123456789abcdef',
    pg_backend_pid()
  ),
  false,
  'backup work fails closed when no freeze is active'
);

alter table app_private.user_accounts enable replica trigger
  guided_operations_backup_freeze_a899cc74db7c2640;
select throws_ok(
  $$ select app_private.begin_production_backup_write_freeze(
    'backup-20260827T115000000Z-0123456789abcdef',
    'OWNER-BACKUP-APPROVAL-000',
    statement_timestamp() + interval '10 minutes'
  ) $$,
  'Production backup freeze table coverage is incomplete',
  'a replica-only table trigger cannot satisfy normal or replica write coverage'
);
alter table app_private.user_accounts enable always trigger
  guided_operations_backup_freeze_a899cc74db7c2640;

create function app_private.test_noop_backup_trigger()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  return null;
end;
$$;
drop trigger guided_operations_backup_freeze_a899cc74db7c2640
  on app_private.user_accounts;
create trigger guided_operations_backup_freeze_a899cc74db7c2640
before insert on app_private.user_accounts
for each statement execute function app_private.test_noop_backup_trigger();
select throws_ok(
  $$ select app_private.begin_production_backup_write_freeze(
    'backup-20260827T115200000Z-0123456789abcdef',
    'OWNER-BACKUP-APPROVAL-000',
    statement_timestamp() + interval '10 minutes'
  ) $$,
  'Production backup freeze table coverage is incomplete',
  'a same-name partial or wrong-function table trigger cannot satisfy coverage'
);
drop trigger guided_operations_backup_freeze_a899cc74db7c2640
  on app_private.user_accounts;
create trigger guided_operations_backup_freeze_a899cc74db7c2640
before insert or update or delete or truncate on app_private.user_accounts
for each statement execute function
  app_private.require_no_production_backup_write_freeze();

alter event trigger guided_operations_backup_freeze_ddl enable replica;
select throws_ok(
  $$ select app_private.begin_production_backup_write_freeze(
    'backup-20260827T115500000Z-0123456789abcdef',
    'OWNER-BACKUP-APPROVAL-000',
    statement_timestamp() + interval '10 minutes'
  ) $$,
  'Production backup freeze DDL coverage is incomplete',
  'a replica-only DDL trigger cannot satisfy backup coverage'
);
alter event trigger guided_operations_backup_freeze_ddl enable always;

create function app_private.test_noop_backup_ddl()
returns event_trigger
language plpgsql
set search_path = ''
as $$
begin
  return;
end;
$$;
drop event trigger guided_operations_backup_freeze_ddl;
create event trigger guided_operations_backup_freeze_ddl
on ddl_command_start
execute function app_private.test_noop_backup_ddl();
alter event trigger guided_operations_backup_freeze_ddl enable always;
select throws_ok(
  $$ select app_private.begin_production_backup_write_freeze(
    'backup-20260827T115700000Z-0123456789abcdef',
    'OWNER-BACKUP-APPROVAL-000',
    statement_timestamp() + interval '10 minutes'
  ) $$,
  'Production backup freeze DDL coverage is incomplete',
  'a same-name DDL trigger bound to the wrong function cannot satisfy coverage'
);
drop event trigger guided_operations_backup_freeze_ddl;
create event trigger guided_operations_backup_freeze_ddl
on ddl_command_start
execute function app_private.require_no_production_backup_ddl();
alter event trigger guided_operations_backup_freeze_ddl enable always;

select set_config(
  'app.test.backup_freeze_pid',
  app_private.begin_production_backup_write_freeze(
    'backup-20260827T120000000Z-0123456789abcdef',
    'OWNER-BACKUP-APPROVAL-001',
    statement_timestamp() + interval '10 minutes'
  )::text,
  true
);
select is(
  app_private.assert_production_backup_write_freeze(
    'backup-20260827T120000000Z-0123456789abcdef',
    current_setting('app.test.backup_freeze_pid')::integer
  ),
  true,
  'the exact owner connection can verify its active unexpired freeze'
);
select throws_ok(
  $$
    insert into app_private.ai_request_budget_months (
      period_start, request_count, policy_answer_request_count,
      report_draft_request_count
    ) values (date_trunc('month', statement_timestamp())::date, 0, 0, 0)
  $$,
  'Production writes are temporarily frozen for a protected backup',
  'database mutations are blocked while the freeze is active'
);
select throws_ok(
  $$ create table app_private.should_not_exist_during_backup (id integer) $$,
  'Production DDL is temporarily frozen for a protected backup',
  'schema changes are blocked while the freeze is active'
);
select is(
  app_private.release_production_backup_write_freeze(
    'backup-20260827T120000000Z-0123456789abcdef',
    current_setting('app.test.backup_freeze_pid')::integer
  ),
  true,
  'the exact owner releases its freeze'
);
select lives_ok(
  $$ create temporary table backup_release_allows_ddl (id integer) $$,
  'normal schema work is allowed after release'
);

select set_config(
  'app.test.backup_freeze_pid',
  app_private.begin_production_backup_write_freeze(
    'backup-20260827T121000000Z-fedcba9876543210',
    'OWNER-BACKUP-APPROVAL-002',
    statement_timestamp() + interval '10 minutes'
  )::text,
  true
);
update app_private.production_backup_write_freeze
set started_at = statement_timestamp() - interval '2 minutes',
    expires_at = statement_timestamp() - interval '1 minute';
select is(
  app_private.assert_production_backup_write_freeze(
    'backup-20260827T121000000Z-fedcba9876543210',
    current_setting('app.test.backup_freeze_pid')::integer
  ),
  false,
  'an expired freeze cannot authorize backup success'
);
select lives_ok(
  $$
    insert into app_private.ai_request_budget_months (
      period_start, request_count, policy_answer_request_count,
      report_draft_request_count
    ) values (date_trunc('month', statement_timestamp())::date, 0, 0, 0)
    on conflict (period_start) do nothing
  $$,
  'database writes automatically resume after the bounded freeze expires'
);
select lives_ok(
  $$ create temporary table backup_expiry_allows_ddl (id integer) $$,
  'schema work automatically resumes after the bounded freeze expires'
);
select is(
  app_private.release_production_backup_write_freeze(
    'backup-20260827T121000000Z-fedcba9876543210',
    current_setting('app.test.backup_freeze_pid')::integer
  ),
  true,
  'the owner can release an expired freeze for bounded recovery'
);

select * from finish();
rollback;
