begin;

-- This forward migration is intentionally separate from the original AI and
-- backup migrations. It upgrades databases that applied those migrations
-- before the security fixes were added to the repository.

drop function if exists app_private.reserve_ai_request_budget(
  uuid, text, integer, integer, integer, integer, integer, integer
);

create function app_private.reserve_ai_request_budget(
  p_account_id uuid,
  p_operation text,
  p_monthly_request_cap integer,
  p_stop_percent integer,
  p_account_monthly_share_percent integer,
  p_account_short_window_max integer,
  p_account_concurrency_max integer,
  p_lease_seconds integer
)
returns table (
  allowed boolean,
  reason_code text,
  lease_id uuid,
  lease_expires_at timestamptz,
  request_count integer,
  effective_limit integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  reservation_time timestamptz;
  current_period date;
  stop_at integer;
  account_stop_at integer;
  global_count integer;
  account_count integer;
  active_lease_count integer;
  window_start timestamptz;
  window_count integer;
  reserved_lease_id uuid;
  reserved_lease_expires_at timestamptz;
begin
  if p_account_id is null or not exists (
    select 1 from app_private.user_accounts as account
    where account.auth_user_id = p_account_id and account.status = 'active'
  ) then
    raise exception 'Invalid AI budget account';
  end if;
  if p_operation not in ('policy_answer', 'report_draft') then
    raise exception 'Invalid AI budget operation';
  end if;
  if p_monthly_request_cap is null or p_monthly_request_cap not between 1 and 1000000 then
    raise exception 'Invalid AI monthly request cap';
  end if;
  if p_stop_percent is null or p_stop_percent not between 1 and 100 then
    raise exception 'Invalid AI budget stop percentage';
  end if;
  if p_account_monthly_share_percent is null
    or p_account_monthly_share_percent not between 1 and 20 then
    raise exception 'Invalid AI account monthly share';
  end if;
  if p_account_short_window_max is null or p_account_short_window_max not between 1 and 100 then
    raise exception 'Invalid AI account rate limit';
  end if;
  if p_account_concurrency_max is null or p_account_concurrency_max not between 1 and 10 then
    raise exception 'Invalid AI account concurrency limit';
  end if;
  if p_lease_seconds is null or p_lease_seconds not between 30 and 300 then
    raise exception 'Invalid AI request lease duration';
  end if;

  stop_at := greatest(
    1,
    floor(p_monthly_request_cap::numeric * p_stop_percent::numeric / 100)::integer
  );
  if stop_at < 2 then
    raise exception 'AI global budget is too small for per-account isolation';
  end if;
  account_stop_at := least(
    stop_at - 1,
    greatest(
      1,
      floor(stop_at::numeric * p_account_monthly_share_percent::numeric / 100)::integer
    )
  );

  perform pg_advisory_xact_lock(hashtextextended(p_account_id::text, 0));
  reservation_time := clock_timestamp();
  current_period := date_trunc(
    'month', reservation_time at time zone 'UTC'
  )::date;
  delete from app_private.ai_request_budget_leases
  where account_id = p_account_id and expires_at <= reservation_time;

  select count(*)::integer into active_lease_count
  from app_private.ai_request_budget_leases
  where account_id = p_account_id and expires_at > reservation_time;
  if active_lease_count >= p_account_concurrency_max then
    return query select false, 'account_concurrency_limited'::text, null::uuid,
      null::timestamptz, active_lease_count, p_account_concurrency_max;
    return;
  end if;

  select budget.request_count into account_count
  from app_private.ai_request_budget_accounts as budget
  where budget.period_start = current_period and budget.account_id = p_account_id;
  account_count := coalesce(account_count, 0);
  if account_count >= account_stop_at then
    return query select false, 'account_monthly_limited'::text, null::uuid,
      null::timestamptz, account_count, account_stop_at;
    return;
  end if;

  select account_window.window_started_at, account_window.request_count
    into window_start, window_count
  from app_private.ai_request_budget_windows as account_window
  where account_window.account_id = p_account_id
    and account_window.operation = p_operation;
  if window_start > reservation_time - interval '1 minute'
    and window_count >= p_account_short_window_max then
    return query select false, 'account_rate_limited'::text, null::uuid,
      null::timestamptz, window_count, p_account_short_window_max;
    return;
  end if;

  insert into app_private.ai_request_budget_months as budget (
    period_start, request_count, policy_answer_request_count,
    report_draft_request_count, updated_at
  ) values (
    current_period, 1,
    case when p_operation = 'policy_answer' then 1 else 0 end,
    case when p_operation = 'report_draft' then 1 else 0 end,
    reservation_time
  )
  on conflict (period_start) do update
  set request_count = budget.request_count + 1,
      policy_answer_request_count = budget.policy_answer_request_count
        + case when p_operation = 'policy_answer' then 1 else 0 end,
      report_draft_request_count = budget.report_draft_request_count
        + case when p_operation = 'report_draft' then 1 else 0 end,
      updated_at = reservation_time
  where budget.request_count < stop_at
  returning budget.request_count into global_count;
  if global_count is null then
    select budget.request_count into global_count
    from app_private.ai_request_budget_months as budget
    where budget.period_start = current_period;
    return query select false, 'budget_exhausted'::text, null::uuid,
      null::timestamptz, global_count, stop_at;
    return;
  end if;

  insert into app_private.ai_request_budget_accounts as budget (
    period_start, account_id, request_count, policy_answer_request_count,
    report_draft_request_count, updated_at
  ) values (
    current_period, p_account_id, 1,
    case when p_operation = 'policy_answer' then 1 else 0 end,
    case when p_operation = 'report_draft' then 1 else 0 end,
    reservation_time
  )
  on conflict (period_start, account_id) do update
  set request_count = budget.request_count + 1,
      policy_answer_request_count = budget.policy_answer_request_count
        + case when p_operation = 'policy_answer' then 1 else 0 end,
      report_draft_request_count = budget.report_draft_request_count
        + case when p_operation = 'report_draft' then 1 else 0 end,
      updated_at = reservation_time;

  insert into app_private.ai_request_budget_windows as account_window (
    account_id, operation, window_started_at, request_count
  ) values (p_account_id, p_operation, reservation_time, 1)
  on conflict (account_id, operation) do update
  set window_started_at = case
        when account_window.window_started_at <= reservation_time - interval '1 minute'
          then reservation_time else account_window.window_started_at end,
      request_count = case
        when account_window.window_started_at <= reservation_time - interval '1 minute'
          then 1 else account_window.request_count + 1 end;

  reserved_lease_expires_at := clock_timestamp()
    + make_interval(secs => p_lease_seconds);
  insert into app_private.ai_request_budget_leases (
    account_id, operation, expires_at
  ) values (
    p_account_id, p_operation, reserved_lease_expires_at
  ) returning id into reserved_lease_id;

  return query select true, 'reserved'::text, reserved_lease_id,
    reserved_lease_expires_at, global_count, stop_at;
end;
$$;

revoke all on function app_private.reserve_ai_request_budget(
  uuid, text, integer, integer, integer, integer, integer, integer
) from public, anon, authenticated, service_role;

create or replace function app_private.begin_production_backup_write_freeze(
  p_backup_id text,
  p_approval_reference text,
  p_expires_at timestamptz
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  lock_key bigint := 764657121624655749;
  freeze_started_at timestamptz := statement_timestamp();
begin
  if p_backup_id is null
    or p_backup_id !~ '^backup-[0-9]{8}T[0-9]{9}Z-[a-f0-9]{16}$' then
    raise exception 'Invalid Production backup freeze identifier';
  end if;
  if p_approval_reference is null
    or p_approval_reference !~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{7,159}$' then
    raise exception 'Invalid Production backup freeze approval';
  end if;
  if p_expires_at is null
    or p_expires_at <= freeze_started_at
    or p_expires_at > freeze_started_at + interval '30 minutes' then
    raise exception 'Invalid Production backup freeze expiry';
  end if;
  if not pg_try_advisory_xact_lock(lock_key) then
    raise exception 'Production writes are active or another backup owns the freeze';
  end if;
  if not exists (
    select 1 from pg_event_trigger
    where evtname = 'guided_operations_backup_freeze_ddl'
      and evtevent = 'ddl_command_start'
      and evtenabled = 'A'
      and evtfoid =
        'app_private.require_no_production_backup_ddl()'::regprocedure
      and evttags is null
  ) then
    raise exception 'Production backup freeze DDL coverage is incomplete';
  end if;
  if exists (
    select 1
    from pg_class as relation
    join pg_namespace as namespace on namespace.oid = relation.relnamespace
    where namespace.nspname in ('app_private', 'auth', 'storage')
      and relation.relkind in ('r', 'p')
      and not (
        namespace.nspname = 'app_private'
        and relation.relname = 'production_backup_write_freeze'
      )
      and (namespace.nspname, relation.relname) not in (
        ('auth', 'schema_migrations'),
        ('storage', 'migrations'),
        ('storage', 'buckets_vectors'),
        ('storage', 'vector_indexes')
      )
      and (
        not has_table_privilege(current_user, relation.oid, 'TRIGGER')
        or not exists (
          select 1 from pg_trigger as table_trigger
          where table_trigger.tgrelid = relation.oid
            and table_trigger.tgname =
              'guided_operations_backup_freeze_' || substr(
                md5(namespace.nspname || '.' || relation.relname), 1, 16
              )
            and table_trigger.tgenabled in ('O', 'A')
            and table_trigger.tgfoid =
              'app_private.require_no_production_backup_write_freeze()'::regprocedure
            and table_trigger.tgtype = 62
        )
      )
  ) then
    raise exception 'Production backup freeze table coverage is incomplete';
  end if;
  delete from app_private.production_backup_write_freeze
  where expires_at <= freeze_started_at;
  if exists (select 1 from app_private.production_backup_write_freeze) then
    raise exception 'Another Production backup freeze is active';
  end if;

  insert into app_private.production_backup_write_freeze (
    backup_id, approval_reference, owner_backend_pid, started_at, expires_at
  ) values (
    p_backup_id, p_approval_reference, pg_backend_pid(),
    freeze_started_at, p_expires_at
  );
  return pg_backend_pid();
exception
  when others then
    raise;
end;
$$;

revoke all on function app_private.begin_production_backup_write_freeze(
  text, text, timestamptz
) from public, anon, authenticated, service_role;

do $$
declare
  target record;
  trigger_name text;
begin
  for target in
    select namespace.nspname as schema_name, relation.relname as table_name,
      relation.oid as relation_oid
    from pg_class as relation
    join pg_namespace as namespace on namespace.oid = relation.relnamespace
    where namespace.nspname in ('app_private', 'auth', 'storage')
      and relation.relkind in ('r', 'p')
      and has_table_privilege(current_user, relation.oid, 'TRIGGER')
      and not (
        namespace.nspname = 'app_private'
        and relation.relname = 'production_backup_write_freeze'
      )
      and (namespace.nspname, relation.relname) not in (
        ('auth', 'schema_migrations'),
        ('storage', 'migrations'),
        ('storage', 'buckets_vectors'),
        ('storage', 'vector_indexes')
      )
  loop
    trigger_name := 'guided_operations_backup_freeze_' ||
      substr(md5(target.schema_name || '.' || target.table_name), 1, 16);
    if not exists (
      select 1 from pg_trigger as table_trigger
      where table_trigger.tgrelid = target.relation_oid
        and table_trigger.tgname = trigger_name
        and table_trigger.tgenabled in ('O', 'A')
        and table_trigger.tgfoid =
          'app_private.require_no_production_backup_write_freeze()'::regprocedure
        and table_trigger.tgtype = 62
        and not table_trigger.tgisinternal
    ) then
      execute format(
        'drop trigger if exists %I on %I.%I',
        trigger_name,
        target.schema_name,
        target.table_name
      );
      execute format(
        'create trigger %I before insert or update or delete or truncate on %I.%I for each statement execute function app_private.require_no_production_backup_write_freeze()',
        trigger_name,
        target.schema_name,
        target.table_name
      );
    end if;
  end loop;
end;
$$;

commit;
