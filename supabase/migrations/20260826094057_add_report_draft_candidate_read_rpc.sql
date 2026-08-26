begin;

create or replace function api.get_report_draft_candidate(p_candidate_id uuid)
returns table (
  candidate_id uuid,
  incident_id uuid,
  source_incident_revision_id uuid,
  report_type text,
  source_fact_ids uuid[],
  paragraphs jsonb,
  created_at timestamptz
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
  if p_candidate_id is null then
    raise exception using errcode = '22023', message = 'Invalid report draft candidate reference';
  end if;

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
      candidate.id,
      candidate.incident_id,
      candidate.source_incident_revision_id,
      candidate.report_type,
      candidate.source_fact_ids,
      candidate.paragraphs,
      candidate.created_at
    from app_private.report_draft_candidates as candidate
    join app_private.incidents as incident on incident.id = candidate.incident_id
    where candidate.id = p_candidate_id
      and incident.facility_id = actor_facility_id
      and incident.archived_at is null
      and (
        actor_role = 'administrator'
        or incident.created_by_account_id = auth.uid()
      );
end;
$$;

comment on function api.get_report_draft_candidate(uuid) is
  'Returns one immutable review-only report draft candidate to its active incident owner or an active same-facility administrator.';

revoke all on function api.get_report_draft_candidate(uuid)
  from public, anon, service_role;
grant usage on schema api to authenticated;
grant execute on function api.get_report_draft_candidate(uuid)
  to authenticated;

commit;
