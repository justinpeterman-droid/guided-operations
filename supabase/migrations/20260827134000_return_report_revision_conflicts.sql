begin;

create or replace function api.append_report_revision(
  p_report_id uuid,
  p_base_revision_number integer,
  p_narrative text,
  p_reason text,
  p_idempotency_key_digest text,
  p_request_digest text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  report_record app_private.reports%rowtype;
  actor_facility_id uuid;
  prior_request_digest text;
  prior_result_code text;
  next_revision_number integer;
begin
  select staff.facility_id
    into actor_facility_id
    from app_private.user_accounts as account
    join app_private.staff_members as staff on staff.id = account.staff_member_id
    where account.auth_user_id = auth.uid()
      and account.status = 'active'
      and staff.status = 'active';

  select report.*
    into report_record
    from app_private.reports as report
    join app_private.incidents as incident on incident.id = report.incident_id
    where report.id = p_report_id
      and report.archived_at is null
      and incident.archived_at is null
      and incident.facility_id = actor_facility_id
      and exists (
        select 1
        from app_private.report_access as access
        where access.report_id = report.id
          and access.account_id = auth.uid()
          and access.revoked_at is null
      )
    for update;

  if not found then
    raise exception using errcode = '42501', message = 'Not authorized to revise this report';
  end if;

  if p_base_revision_number <> report_record.current_revision_number then
    return 0;
  end if;

  if coalesce(char_length(p_narrative), 0) not between 1 and 50000
    or coalesce(char_length(p_reason), 0) not between 1 and 500
    or p_idempotency_key_digest !~ '^[a-f0-9]{64}$'
    or p_request_digest !~ '^[a-f0-9]{64}$' then
    raise exception using errcode = '22023', message = 'Invalid report revision request';
  end if;

  select request_digest, result_code
    into prior_request_digest, prior_result_code
    from app_private.idempotency_records
    where actor_account_id = auth.uid()
      and action = 'report.revise'
      and idempotency_key_digest = p_idempotency_key_digest
    for update;

  if found then
    if prior_request_digest <> p_request_digest then
      raise exception using errcode = '22023', message = 'Retry key was reused for a different request';
    end if;
    if prior_result_code ~ '^report\.revised\.r[1-9][0-9]*$' then
      return substring(prior_result_code from '[0-9]+$')::integer;
    end if;
    return 0;
  end if;

  next_revision_number := report_record.current_revision_number + 1;
  insert into app_private.idempotency_records (
    actor_account_id, action, idempotency_key_digest, request_digest, expires_at
  ) values (
    auth.uid(), 'report.revise', p_idempotency_key_digest, p_request_digest,
    statement_timestamp() + interval '24 hours'
  );

  insert into app_private.report_revisions (
    report_id, revision_number, editor_account_id, source_incident_revision_id,
    narrative, reason, schema_version, provenance
  )
  select
    report_record.id, next_revision_number, auth.uid(), revision.source_incident_revision_id,
    p_narrative, p_reason, revision.schema_version,
    jsonb_build_object('prior_revision_number', report_record.current_revision_number)
  from app_private.report_revisions as revision
  where revision.report_id = report_record.id
    and revision.revision_number = report_record.current_revision_number;

  update app_private.idempotency_records as record
    set status = 'succeeded',
        result_reference_id = report_record.id,
        result_code = format('report.revised.r%s', next_revision_number)
    where record.actor_account_id = auth.uid()
      and record.action = 'report.revise'
      and record.idempotency_key_digest = p_idempotency_key_digest;

  return next_revision_number;
end;
$$;

comment on function api.append_report_revision(uuid, integer, text, text, text, text) is
  'Appends one collaborator-authorized immutable report revision; returns zero for a stale base or in-progress retry so HTTP callers can return a bounded conflict response. Facility-wide administrator correction remains denied until a purpose-bound step-up workflow exists.';

revoke all on function api.append_report_revision(uuid, integer, text, text, text, text)
  from public, anon, service_role;
grant execute on function api.append_report_revision(uuid, integer, text, text, text, text)
  to authenticated;

commit;
