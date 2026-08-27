begin;

create table app_private.ai_request_budget_accounts (
  period_start date not null check (
    period_start = date_trunc('month', period_start)::date
  ),
  account_id uuid not null,
  request_count integer not null default 0 check (request_count >= 0),
  policy_answer_request_count integer not null default 0 check (
    policy_answer_request_count >= 0
  ),
  report_draft_request_count integer not null default 0 check (
    report_draft_request_count >= 0
  ),
  updated_at timestamptz not null default statement_timestamp(),
  primary key (period_start, account_id),
  check (
    request_count = policy_answer_request_count + report_draft_request_count
  )
);

create table app_private.ai_request_budget_windows (
  account_id uuid not null,
  operation text not null check (operation in ('policy_answer', 'report_draft')),
  window_started_at timestamptz not null,
  request_count integer not null check (request_count > 0),
  primary key (account_id, operation)
);

create table app_private.ai_request_budget_leases (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  operation text not null check (operation in ('policy_answer', 'report_draft')),
  expires_at timestamptz not null,
  created_at timestamptz not null default statement_timestamp()
);

create index ai_request_budget_leases_active_idx
  on app_private.ai_request_budget_leases (account_id, expires_at);

comment on table app_private.ai_request_budget_accounts is
  'Opaque per-account monthly counters that prevent one account from consuming the shared AI budget.';
comment on table app_private.ai_request_budget_windows is
  'Opaque per-account short-window AI counters with no prompt or personnel fields.';
comment on table app_private.ai_request_budget_leases is
  'Short-lived opaque concurrency leases; expired leases recover automatically.';

create or replace function app_private.reserve_ai_request_budget(
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
  request_count integer,
  effective_limit integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  reservation_time timestamptz := statement_timestamp();
  current_period date := date_trunc(
    'month', reservation_time at time zone 'UTC'
  )::date;
  stop_at integer;
  account_stop_at integer;
  global_count integer;
  account_count integer;
  active_lease_count integer;
  window_start timestamptz;
  window_count integer;
  reserved_lease_id uuid;
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
  delete from app_private.ai_request_budget_leases
  where account_id = p_account_id and expires_at <= reservation_time;

  select count(*)::integer into active_lease_count
  from app_private.ai_request_budget_leases
  where account_id = p_account_id and expires_at > reservation_time;
  if active_lease_count >= p_account_concurrency_max then
    return query select false, 'account_concurrency_limited'::text, null::uuid,
      active_lease_count, p_account_concurrency_max;
    return;
  end if;

  select budget.request_count into account_count
  from app_private.ai_request_budget_accounts as budget
  where budget.period_start = current_period and budget.account_id = p_account_id;
  account_count := coalesce(account_count, 0);
  if account_count >= account_stop_at then
    return query select false, 'account_monthly_limited'::text, null::uuid,
      account_count, account_stop_at;
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
      window_count, p_account_short_window_max;
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
      global_count, stop_at;
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

  insert into app_private.ai_request_budget_leases (
    account_id, operation, expires_at
  ) values (
    p_account_id, p_operation,
    reservation_time + make_interval(secs => p_lease_seconds)
  ) returning id into reserved_lease_id;

  return query select true, 'reserved'::text, reserved_lease_id,
    global_count, stop_at;
end;
$$;

create or replace function app_private.release_ai_request_budget_lease(
  p_account_id uuid,
  p_lease_id uuid
)
returns boolean
language sql
security definer
set search_path = ''
as $$
  with released as (
    delete from app_private.ai_request_budget_leases
    where id = p_lease_id and account_id = p_account_id
    returning 1
  )
  select exists (select 1 from released);
$$;

create or replace function app_private.reserve_ai_request_budget(
  p_operation text,
  p_monthly_request_cap integer,
  p_stop_percent integer
)
returns table (
  allowed boolean,
  reason_code text,
  request_count integer,
  effective_limit integer
)
language sql
security definer
set search_path = ''
as $$
  select false, 'budget_exhausted'::text, 0, 0;
$$;

comment on function app_private.reserve_ai_request_budget(text, integer, integer) is
  'Fail-closed compatibility signature for pre-fair-use application instances; it never reserves provider capacity.';

alter table app_private.ai_request_budget_accounts enable row level security;
alter table app_private.ai_request_budget_accounts force row level security;
alter table app_private.ai_request_budget_windows enable row level security;
alter table app_private.ai_request_budget_windows force row level security;
alter table app_private.ai_request_budget_leases enable row level security;
alter table app_private.ai_request_budget_leases force row level security;

revoke all on table app_private.ai_request_budget_accounts,
  app_private.ai_request_budget_windows,
  app_private.ai_request_budget_leases
  from public, anon, authenticated, service_role;
revoke all on function app_private.reserve_ai_request_budget(
  uuid, text, integer, integer, integer, integer, integer, integer
) from public, anon, authenticated, service_role;
revoke all on function app_private.release_ai_request_budget_lease(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function app_private.reserve_ai_request_budget(
  text, integer, integer
) from public, anon, authenticated, service_role;

commit;
