begin;

create table app_private.ai_request_budget_months (
  period_start date primary key check (
    period_start = date_trunc('month', period_start)::date
  ),
  request_count integer not null default 0 check (request_count >= 0),
  policy_answer_request_count integer not null default 0 check (
    policy_answer_request_count >= 0
  ),
  report_draft_request_count integer not null default 0 check (
    report_draft_request_count >= 0
  ),
  updated_at timestamptz not null default statement_timestamp(),
  check (
    request_count = policy_answer_request_count + report_draft_request_count
  )
);

comment on table app_private.ai_request_budget_months is
  'Content-free monthly counters used by the global AI request circuit breaker.';

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
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_period date := date_trunc(
    'month', statement_timestamp() at time zone 'UTC'
  )::date;
  stop_at integer;
  reserved_count integer;
begin
  if p_operation not in ('policy_answer', 'report_draft') then
    raise exception 'Invalid AI budget operation';
  end if;
  if p_monthly_request_cap is null
    or p_monthly_request_cap < 1
    or p_monthly_request_cap > 1000000 then
    raise exception 'Invalid AI monthly request cap';
  end if;
  if p_stop_percent is null
    or p_stop_percent < 1
    or p_stop_percent > 100 then
    raise exception 'Invalid AI budget stop percentage';
  end if;

  stop_at := greatest(
    1,
    floor(p_monthly_request_cap::numeric * p_stop_percent::numeric / 100)::integer
  );

  insert into app_private.ai_request_budget_months as budget (
    period_start,
    request_count,
    policy_answer_request_count,
    report_draft_request_count,
    updated_at
  ) values (
    current_period,
    1,
    case when p_operation = 'policy_answer' then 1 else 0 end,
    case when p_operation = 'report_draft' then 1 else 0 end,
    statement_timestamp()
  )
  on conflict (period_start) do update
  set request_count = budget.request_count + 1,
      policy_answer_request_count = budget.policy_answer_request_count
        + case when p_operation = 'policy_answer' then 1 else 0 end,
      report_draft_request_count = budget.report_draft_request_count
        + case when p_operation = 'report_draft' then 1 else 0 end,
      updated_at = statement_timestamp()
  where budget.request_count < stop_at
  returning budget.request_count into reserved_count;

  if reserved_count is null then
    select budget.request_count into reserved_count
    from app_private.ai_request_budget_months as budget
    where budget.period_start = current_period;

    return query select false, 'budget_exhausted'::text, reserved_count, stop_at;
    return;
  end if;

  return query select true, 'reserved'::text, reserved_count, stop_at;
end;
$$;

comment on function app_private.reserve_ai_request_budget(text, integer, integer) is
  'Atomically reserves one content-free global AI request slot and fails closed at the configured percentage of the monthly cap.';

alter table app_private.ai_request_budget_months enable row level security;
alter table app_private.ai_request_budget_months force row level security;

revoke all on table app_private.ai_request_budget_months
  from public, anon, authenticated, service_role;
revoke all on function app_private.reserve_ai_request_budget(text, integer, integer)
  from public, anon, authenticated, service_role;

commit;
