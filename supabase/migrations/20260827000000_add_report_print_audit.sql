begin;

create or replace function api.record_report_print(
  p_report_id uuid,
  p_revision_number integer,
  p_idempotency_key_digest text,
  p_request_digest text,
  p_request_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_role text;
  actor_facility_id uuid;
  report_record app_private.reports%rowtype;
  prior_request_digest text;
  prior_result_id uuid;
  prior_result_code text;
  audit_event_id uuid;
begin
  if p_report_id is null
    or p_revision_number is null or p_revision_number < 1
    or p_idempotency_key_digest !~ '^[a-f0-9]{64}$'
    or p_request_digest !~ '^[a-f0-9]{64}$'
    or p_request_id is null then
    raise exception using errcode = '22023', message = 'Invalid report print request';
  end if;

  select account.role::text, staff.facility_id
    into actor_role, actor_facility_id
    from app_private.user_accounts as account
    join app_private.staff_members as staff on staff.id = account.staff_member_id
    where account.auth_user_id = auth.uid()
      and account.status = 'active'
      and staff.status = 'active';

  if not found then
    raise exception using errcode = '42501', message = 'Not authorized to print this report';
  end if;

  select candidate.*
    into report_record
    from app_private.reports as candidate
    join app_private.incidents as incident on incident.id = candidate.incident_id
    where candidate.id = p_report_id
      and candidate.status = 'complete'
      and candidate.archived_at is null
      and incident.archived_at is null
      and incident.facility_id = actor_facility_id
      and (
        actor_role = 'administrator'
        or exists (
          select 1
          from app_private.report_access as access
          where access.report_id = candidate.id
            and access.account_id = auth.uid()
            and access.revoked_at is null
        )
      )
    for update of candidate;

  if not found then
    raise exception using errcode = '42501', message = 'Not authorized to print this report';
  end if;
  if p_revision_number <> report_record.current_revision_number then
    raise exception using errcode = '40001', message = 'Report revision conflict';
  end if;

  select request_digest, result_reference_id, result_code
    into prior_request_digest, prior_result_id, prior_result_code
    from app_private.idempotency_records
    where actor_account_id = auth.uid()
      and action = 'report.output.print'
      and idempotency_key_digest = p_idempotency_key_digest
    for update;

  if found then
    if prior_request_digest <> p_request_digest then
      raise exception using errcode = '22023', message = 'Retry key was reused for a different request';
    end if;
    if prior_result_id is not null and prior_result_code = 'report.print.request.recorded' then
      return prior_result_id;
    end if;
    raise exception using errcode = '40001', message = 'Report print audit is already in progress';
  end if;

  insert into app_private.idempotency_records (
    actor_account_id, action, idempotency_key_digest, request_digest, expires_at
  ) values (
    auth.uid(), 'report.output.print', p_idempotency_key_digest,
    p_request_digest, statement_timestamp() + interval '24 hours'
  );

  insert into app_private.audit_events (
    facility_id, actor_auth_user_id, event_type, target_type, target_id,
    request_id, metadata
  ) values (
    actor_facility_id, auth.uid(), 'report.print.requested', 'report',
    report_record.id, p_request_id,
    jsonb_build_object('action', 'print', 'revision_number', p_revision_number)
  )
  returning event_id into audit_event_id;

  update app_private.idempotency_records
    set status = 'succeeded',
        result_reference_id = audit_event_id,
        result_code = 'report.print.request.recorded'
    where actor_account_id = auth.uid()
      and action = 'report.output.print'
      and idempotency_key_digest = p_idempotency_key_digest;

  return audit_event_id;
end;
$$;

comment on function api.record_report_print(uuid, integer, text, text, uuid) is
  'Records a redacted, idempotent print-request audit before an authorized account opens the print dialog for the current complete report revision.';

revoke all on function api.record_report_print(uuid, integer, text, text, uuid)
  from public, anon, service_role;
grant usage on schema api to authenticated;
grant execute on function api.record_report_print(uuid, integer, text, text, uuid)
  to authenticated;

commit;
