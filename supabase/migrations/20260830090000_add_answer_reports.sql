begin;

-- Officer-reported wrong or doubtful answers.
--
-- This is the only signal that tells the owner an answer was wrong. The corpus
-- is refreshed by hand once a year, so nothing else detects a stale or
-- mis-cited answer between refreshes. Reports are stored with the question, the
-- answer as shown, and the citations as shown, because a report without the
-- exact answer text cannot be investigated later.

create table app_private.answer_reports (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references app_private.facilities (id),
  reported_by_account_id uuid not null,
  reported_at timestamptz not null default statement_timestamp(),
  question text not null,
  answer_text text not null,
  citations jsonb not null default '[]'::jsonb,
  corpus_version text,
  reviewed_at timestamptz,
  reviewer_note text,
  constraint answer_reports_question_bounded
    check (char_length(question) between 3 and 2000),
  constraint answer_reports_answer_bounded
    check (char_length(answer_text) between 1 and 20000),
  constraint answer_reports_citations_array
    check (jsonb_typeof(citations) = 'array'),
  constraint answer_reports_corpus_version_bounded
    check (corpus_version is null or char_length(corpus_version) between 1 and 160),
  constraint answer_reports_reviewer_note_bounded
    check (reviewer_note is null or char_length(reviewer_note) between 1 and 2000),
  constraint answer_reports_reviewed_note_requires_time
    check (reviewer_note is null or reviewed_at is not null)
);

comment on table app_private.answer_reports is
  'Answers an officer flagged as wrong or doubtful. Reviewed by the owner; the queue of unreviewed rows is the accuracy backlog.';

create index answer_reports_unreviewed_idx
  on app_private.answer_reports (reported_at desc, id desc)
  where reviewed_at is null;

alter table app_private.answer_reports enable row level security;
alter table app_private.answer_reports force row level security;

revoke all on table app_private.answer_reports
  from public, anon, authenticated, service_role;

-- Every application table must participate in the Production backup write
-- freeze, or a backup could be taken while this table is being written.
-- production_backup_freeze.test.sql enforces this.
do $$
declare
  trigger_name text := 'guided_operations_backup_freeze_' ||
    substr(md5('app_private.answer_reports'), 1, 16);
begin
  execute format(
    'create trigger %I before insert or update or delete or truncate on app_private.answer_reports for each statement execute function app_private.require_no_production_backup_write_freeze()',
    trigger_name
  );
end;
$$;

-- Reporting is deliberately unconditional: an officer may report any answer
-- they were shown, without a supervisor, without a reason, and without a
-- rate limit beyond the request budget that already guards the app. Friction
-- here means wrong answers go unreported, which is the failure this exists to
-- prevent.
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
  'Records an officer report that a shown policy answer was wrong or doubtful.';

revoke all on function api.report_policy_answer(text, text, jsonb, text)
  from public, anon, service_role;
grant execute on function api.report_policy_answer(text, text, jsonb, text)
  to authenticated;

commit;
