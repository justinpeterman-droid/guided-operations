begin;

create index answer_reports_account_quota_idx
  on app_private.answer_reports (reported_by_account_id, occurred_at desc);

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
  v_report_id uuid;
begin
  if v_actor_account_id is null or v_facility_id is null then
    raise exception using
      errcode = '42501',
      message = 'Not authorized to report an answer';
  end if;

  if jsonb_typeof(coalesce(p_citations, '[]'::jsonb)) <> 'array' then
    raise exception using
      errcode = '22023',
      message = 'Citations must be a JSON array';
  end if;

  -- Serialize quota checks for this account so concurrent requests cannot all
  -- observe the same remaining slot and overrun the bound.
  perform pg_advisory_xact_lock(
    hashtextextended('answer-report:' || v_actor_account_id::text, 0)
  );
  if (
    select count(*)
    from app_private.answer_reports
    where reported_by_account_id = v_actor_account_id
      and occurred_at >= statement_timestamp() - interval '24 hours'
  ) >= 100 then
    raise exception using
      errcode = '54000',
      message = 'Daily answer report quota exceeded';
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
    coalesce(p_citations, '[]'::jsonb),
    nullif(p_corpus_version, '')
  )
  returning id into v_report_id;

  return v_report_id;
end;
$$;

comment on function api.report_policy_answer(text, text, jsonb, text) is
  'Records an officer report that a shown policy answer was wrong or doubtful, bounded to 100 reports per account in 24 hours.';

revoke all on function api.report_policy_answer(text, text, jsonb, text)
  from public, anon, service_role;
grant execute on function api.report_policy_answer(text, text, jsonb, text)
  to authenticated;

commit;
