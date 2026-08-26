begin;

create or replace function api.record_count_sheet_print(
  p_record_id uuid,
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
  actor_facility_id uuid;
  actor_shift_code text;
  record app_private.paperwork_records%rowtype;
  prior_request_digest text;
  prior_result_id uuid;
  prior_result_code text;
  audit_event_id uuid;
begin
  if p_record_id is null
    or p_revision_number is null or p_revision_number < 1
    or p_idempotency_key_digest !~ '^[a-f0-9]{64}$'
    or p_request_digest !~ '^[a-f0-9]{64}$'
    or p_request_id is null then
    raise exception using errcode = '22023', message = 'Invalid Count Sheet print request';
  end if;

  select staff.facility_id, staff.shift_code
    into actor_facility_id, actor_shift_code
    from app_private.user_accounts as account
    join app_private.staff_members as staff on staff.id = account.staff_member_id
    where account.auth_user_id = auth.uid()
      and account.status = 'active'
      and staff.status = 'active';

  if not found or actor_shift_code is null then
    raise exception using errcode = '42501', message = 'Not authorized to print this Count Sheet';
  end if;

  select candidate.*
    into record
    from app_private.paperwork_records as candidate
    where candidate.id = p_record_id
      and candidate.kind = 'count_sheet'
      and candidate.facility_id = actor_facility_id
      and candidate.shift_code = actor_shift_code
      and candidate.archived_at is null
    for update;

  if not found then
    raise exception using errcode = '42501', message = 'Not authorized to print this Count Sheet';
  end if;
  if p_revision_number <> record.current_revision_number then
    raise exception using errcode = '40001', message = 'Count Sheet revision conflict';
  end if;

  select request_digest, result_reference_id, result_code
    into prior_request_digest, prior_result_id, prior_result_code
    from app_private.idempotency_records
    where actor_account_id = auth.uid()
      and action = 'count_sheet.output.print'
      and idempotency_key_digest = p_idempotency_key_digest
    for update;

  if found then
    if prior_request_digest <> p_request_digest then
      raise exception using errcode = '22023', message = 'Retry key was reused for a different request';
    end if;
    if prior_result_id is not null and prior_result_code = 'count_sheet.print.request.recorded' then
      return prior_result_id;
    end if;
    raise exception using errcode = '40001', message = 'Count Sheet print audit is already in progress';
  end if;

  insert into app_private.idempotency_records (
    actor_account_id, action, idempotency_key_digest, request_digest, expires_at
  ) values (
    auth.uid(), 'count_sheet.output.print', p_idempotency_key_digest,
    p_request_digest, statement_timestamp() + interval '24 hours'
  );

  insert into app_private.audit_events (
    facility_id, actor_auth_user_id, event_type, target_type, target_id,
    request_id, metadata
  ) values (
    actor_facility_id, auth.uid(), 'count_sheet.print.requested', 'paperwork_record',
    record.id, p_request_id,
    jsonb_build_object('action', 'print', 'revision_number', p_revision_number)
  )
  returning event_id into audit_event_id;

  update app_private.idempotency_records
    set status = 'succeeded',
        result_reference_id = audit_event_id,
        result_code = 'count_sheet.print.request.recorded'
    where actor_account_id = auth.uid()
      and action = 'count_sheet.output.print'
      and idempotency_key_digest = p_idempotency_key_digest;

  return audit_event_id;
end;
$$;

comment on function api.record_count_sheet_print(uuid, integer, text, text, uuid) is
  'Records a redacted, idempotent print-request audit before the active same-shift account opens the print dialog for the current saved Count Sheet revision.';

revoke all on function api.record_count_sheet_print(uuid, integer, text, text, uuid)
  from public, anon, service_role;
grant usage on schema api to authenticated;
grant execute on function api.record_count_sheet_print(uuid, integer, text, text, uuid)
  to authenticated;

commit;
