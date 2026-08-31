begin;

-- Bound the complete serialized citation payload at the storage boundary. The
-- application applies the same ceiling before invoking this function, while
-- this constraint protects direct RPC callers and every future write path.
alter table app_private.answer_reports
  add constraint answer_reports_citations_payload_bounded
  check (octet_length(citations::text) <= 32768);

-- Do not rewrite historical 'as shown' citations. Adding the constraint as valid
-- verifies every existing row and fails the migration if an owner must review one.
-- New and historical records therefore share the same storage guarantee.

create or replace function api.report_policy_answer(
  p_question text,
  p_answer_text text,
  p_citations jsonb,
  p_corpus_version text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_account_id uuid := auth.uid();
  v_facility_id uuid := app_private.current_active_facility_id();
  v_citations jsonb := coalesce(p_citations, '[]'::jsonb);
  v_report_id uuid;
begin
  if v_actor_account_id is null or v_facility_id is null then
    raise exception using
      errcode = '42501',
      message = 'Not authorized to report an answer';
  end if;

  if jsonb_typeof(v_citations) <> 'array' then
    raise exception using
      errcode = '22023',
      message = 'Citations must be a JSON array';
  end if;

  if jsonb_array_length(v_citations) > 20 then
    raise exception using
      errcode = '22023',
      message = 'Too many citations';
  end if;

  if octet_length(v_citations::text) > 32768 then
    raise exception using
      errcode = '22023',
      message = 'Citations payload is too large';
  end if;

  -- Serialize the rolling-window check and insert for this account. Without
  -- the transaction-scoped lock, concurrent direct RPC calls could all count
  -- the same prior rows and exceed the ceiling together.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(v_actor_account_id::text)
  );

  if (
    select count(*)
    from app_private.answer_reports as report
    where report.reported_by_account_id = v_actor_account_id
      and report.occurred_at >= statement_timestamp() - interval '1 hour'
  ) >= 30 then
    raise exception using
      errcode = '54000',
      message = 'Answer report limit reached';
  end if;

  insert into app_private.answer_reports (
    facility_id,
    reported_by_account_id,
    question,
    answer_text,
    citations,
    corpus_version
  ) values (
    v_facility_id,
    v_actor_account_id,
    p_question,
    p_answer_text,
    v_citations,
    nullif(p_corpus_version, '')
  )
  returning id into v_report_id;

  return v_report_id;
end;
$$;

comment on function api.report_policy_answer(text, text, jsonb, text) is
  'Records an officer report with bounded shown citations and an atomic per-account rolling quota.';

revoke all on function api.report_policy_answer(text, text, jsonb, text)
  from public, anon, service_role;
grant execute on function api.report_policy_answer(text, text, jsonb, text)
  to authenticated;

commit;
