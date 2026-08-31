begin;

create function api.get_incident_summary(p_incident_id uuid)
returns table (
  incident_id uuid,
  incident_number text,
  display_name text,
  status text,
  occurred_at timestamptz,
  category text,
  current_revision_number integer,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    incident.id,
    incident.incident_number,
    incident.display_name,
    incident.status,
    incident.occurred_at,
    incident.category,
    incident.current_revision_number,
    incident.updated_at
  from app_private.incidents as incident
  where incident.id = p_incident_id
    and incident.archived_at is null
    and app_private.can_access_incident(incident.id);
$$;

comment on function api.get_incident_summary(uuid) is
  'Returns one summary-only active incident when the current account is authorized.';

revoke all on function api.get_incident_summary(uuid)
  from public, anon, service_role;
grant execute on function api.get_incident_summary(uuid) to authenticated;

create function api.list_incident_reports(p_incident_id uuid)
returns table (
  report_id uuid,
  incident_number text,
  incident_name text,
  report_type text,
  status text,
  current_revision_number integer,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_role text;
  actor_facility_id uuid;
begin
  select account.role::text, staff.facility_id
    into actor_role, actor_facility_id
    from app_private.user_accounts as account
    join app_private.staff_members as staff on staff.id = account.staff_member_id
    where account.auth_user_id = auth.uid()
      and account.status = 'active'
      and staff.status = 'active';

  if not found then
    return;
  end if;

  return query
    select
      report.id,
      incident.incident_number,
      incident.display_name,
      report.report_type,
      report.status,
      report.current_revision_number,
      report.updated_at
    from app_private.reports as report
    join app_private.incidents as incident on incident.id = report.incident_id
    where incident.id = p_incident_id
      and report.archived_at is null
      and incident.archived_at is null
      and incident.facility_id = actor_facility_id
      and app_private.can_access_incident(incident.id)
      and (
        actor_role = 'administrator'
        or exists (
          select 1
          from app_private.report_access as access
          where access.report_id = report.id
            and access.account_id = auth.uid()
            and access.revoked_at is null
        )
      )
    order by report.updated_at desc, report.id desc;
end;
$$;

comment on function api.list_incident_reports(uuid) is
  'Returns every active report summary authorized for one accessible incident.';

revoke all on function api.list_incident_reports(uuid)
  from public, anon, service_role;
grant execute on function api.list_incident_reports(uuid) to authenticated;

create index answer_reports_account_occurred_idx
  on app_private.answer_reports (reported_by_account_id, occurred_at desc);

alter table app_private.answer_reports
  add constraint answer_reports_citations_count_bounded
    check (jsonb_array_length(citations) <= 20),
  add constraint answer_reports_citations_bytes_bounded
    check (octet_length(citations::text) <= 32000);

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
  v_recent_report_count integer;
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
  -- observe the same remaining slot before inserting.
  perform pg_advisory_xact_lock(hashtextextended(v_actor_account_id::text, 0));
  select count(*)
    into v_recent_report_count
    from app_private.answer_reports as report
    where report.reported_by_account_id = v_actor_account_id
      and report.occurred_at >= statement_timestamp() - interval '24 hours';

  if v_recent_report_count >= 100 then
    raise exception using
      errcode = '54000',
      message = 'Answer report quota reached';
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
  'Records an officer report of a wrong or doubtful policy answer, up to 100 reports per account in a rolling 24-hour window.';

commit;
