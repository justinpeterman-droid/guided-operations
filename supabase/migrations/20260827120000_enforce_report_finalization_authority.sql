begin;

create or replace function api.finalize_report_draft_candidate(
  p_candidate_id uuid,
  p_narrative text,
  p_idempotency_key_digest text,
  p_request_digest text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate_record app_private.report_draft_candidates%rowtype;
  actor_role app_private.account_role;
  reporting_account_id uuid;
  existing_request_digest text;
  existing_status text;
  existing_report_id uuid;
  report_id uuid;
begin
  select candidate.* into candidate_record
    from app_private.report_draft_candidates as candidate
    where candidate.id = p_candidate_id
      and app_private.can_access_incident(candidate.incident_id);

  if not found then
    raise exception using errcode = '42501', message = 'Not authorized to finalize this report draft';
  end if;

  select account.auth_user_id into reporting_account_id
    from app_private.user_accounts as account
    join app_private.staff_members as staff on staff.id = account.staff_member_id
    where staff.id = candidate_record.reporting_staff_member_id
      and staff.status = 'active'
      and account.status = 'active';

  if not found then
    raise exception using errcode = '42501', message = 'Reporting officer is not available';
  end if;

  select account.role into actor_role
    from app_private.user_accounts as account
    join app_private.staff_members as staff on staff.id = account.staff_member_id
    where account.auth_user_id = auth.uid()
      and account.status = 'active'
      and staff.status = 'active';

  if not found
    or (
      actor_role <> 'administrator'
      and auth.uid() <> reporting_account_id
    ) then
    raise exception using errcode = '42501', message = 'Not authorized to finalize this report draft';
  end if;

  if coalesce(char_length(p_narrative), 0) not between 1 and 50000
    or p_idempotency_key_digest !~ '^[a-f0-9]{64}$'
    or p_request_digest !~ '^[a-f0-9]{64}$' then
    raise exception using errcode = '22023', message = 'Invalid report finalization request';
  end if;

  select record.request_digest, record.status, record.result_reference_id
    into existing_request_digest, existing_status, existing_report_id
    from app_private.idempotency_records as record
    where record.actor_account_id = auth.uid()
      and record.action = 'report.finalize'
      and record.idempotency_key_digest = p_idempotency_key_digest
    for update;

  if found then
    if existing_request_digest <> p_request_digest then
      raise exception using errcode = '22023', message = 'Retry key was reused for a different request';
    end if;
    if existing_status = 'succeeded' and existing_report_id is not null then
      return existing_report_id;
    end if;
    raise exception using errcode = '40001', message = 'Report finalization is already in progress';
  end if;

  perform 1
    from app_private.incidents as incident
    join app_private.incident_revisions as revision
      on revision.incident_id = incident.id
      and revision.revision_number = incident.current_revision_number
    where incident.id = candidate_record.incident_id
      and revision.id = candidate_record.source_incident_revision_id
    for share of incident;

  if not found then
    raise exception using
      errcode = '40001',
      message = 'Report draft is stale and must be regenerated';
  end if;

  insert into app_private.idempotency_records (
    actor_account_id,
    action,
    idempotency_key_digest,
    request_digest,
    expires_at
  ) values (
    auth.uid(),
    'report.finalize',
    p_idempotency_key_digest,
    p_request_digest,
    statement_timestamp() + interval '24 hours'
  );

  insert into app_private.reports (
    incident_id,
    report_type,
    reporting_account_id,
    prepared_by_account_id,
    status
  ) values (
    candidate_record.incident_id,
    candidate_record.report_type,
    reporting_account_id,
    candidate_record.requested_by_account_id,
    'complete'
  ) returning id into report_id;

  insert into app_private.report_access (
    report_id, account_id, relationship, granted_by_account_id
  ) values (
    report_id, reporting_account_id, 'owner', auth.uid()
  );

  if candidate_record.requested_by_account_id <> reporting_account_id then
    insert into app_private.report_access (
      report_id, account_id, relationship, granted_by_account_id
    ) values (
      report_id, candidate_record.requested_by_account_id, 'preparer', auth.uid()
    );
  end if;

  insert into app_private.report_revisions (
    report_id,
    revision_number,
    editor_account_id,
    source_incident_revision_id,
    narrative,
    schema_version,
    provenance
  ) values (
    report_id,
    1,
    auth.uid(),
    candidate_record.source_incident_revision_id,
    p_narrative,
    1,
    jsonb_build_object('draft_candidate_id', candidate_record.id::text)
  );

  update app_private.idempotency_records as record
    set status = 'succeeded',
        result_reference_id = report_id,
        result_code = 'report.finalized'
    where record.actor_account_id = auth.uid()
      and record.action = 'report.finalize'
      and record.idempotency_key_digest = p_idempotency_key_digest;

  return report_id;
end;
$$;

comment on function api.finalize_report_draft_candidate(uuid, text, text, text) is
  'Finalizes only a current-revision attributed draft for its active reporting officer or an active same-facility administrator while preserving preparer and editor attribution.';

revoke all on function api.finalize_report_draft_candidate(uuid, text, text, text)
  from public, anon, service_role;
grant execute on function api.finalize_report_draft_candidate(uuid, text, text, text)
  to authenticated;

commit;
