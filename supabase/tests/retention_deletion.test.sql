begin;

select plan(39);

select has_table(
  'app_private', 'retention_deletion_requests',
  'private retention deletion requests exist'
);
select has_table(
  'app_private', 'record_artifacts',
  'private generated-export integrity records exist'
);
select has_trigger(
  'app_private', 'record_artifacts', 'record_artifacts_validate_target',
  'artifact registration validates the target and shares its deletion lock'
);
select ok(
  to_regprocedure(
    'app_private.approve_retention_deletion(uuid,text,uuid,text,text,text,text,timestamptz,timestamptz)'
  ) is not null,
  'backup-aware deletion approval exists'
);
select ok(
  to_regprocedure('app_private.begin_retention_deletion(uuid,uuid,uuid)') is not null
    and to_regprocedure(
      'app_private.complete_retention_deletion(uuid,uuid)'
    ) is not null,
  'same-transaction deletion begin and completion routines exist'
);
select ok(
  not has_table_privilege(
    'authenticated', 'app_private.retention_deletion_requests', 'select'
  )
    and not has_table_privilege(
      'service_role', 'app_private.record_artifacts', 'select'
    ),
  'Data API roles cannot read deletion or artifact evidence directly'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'app_private.approve_retention_deletion(uuid,text,uuid,text,text,text,text,timestamptz,timestamptz)',
    'execute'
  )
    and not has_function_privilege(
      'service_role',
      'app_private.complete_retention_deletion(uuid,uuid)',
      'execute'
    ),
  'Data API roles cannot invoke controlled deletion routines'
);
select ok(
  to_regprocedure(
    'app_private.list_retention_deletion_requests(uuid,boolean,integer)'
  ) is not null
    and not has_function_privilege(
      'service_role',
      'app_private.list_retention_deletion_requests(uuid,boolean,integer)',
      'execute'
    ),
  'only the private server connection can list deletion evidence'
);
select ok(
  (
    select bool_and(relation.relrowsecurity and relation.relforcerowsecurity)
    from pg_class as relation
    where relation.oid in (
      'app_private.retention_deletion_requests'::regclass,
      'app_private.record_artifacts'::regclass
    )
  ),
  'deletion and artifact evidence force row-level security'
);

insert into auth.users (id, email)
values
  ('81818181-8181-4181-8181-818181818181', 'deletion-admin@example.invalid'),
  ('82828282-8282-4282-8282-828282828282', 'deletion-officer@example.invalid');

insert into app_private.staff_members (
  id, facility_id, employee_lookup_hash, employee_number_hint, display_name,
  status
)
select
  '83838383-8383-4383-8383-838383838383', id, repeat('8', 64), '81',
  'Fictional Deletion Administrator', 'active'
from app_private.facilities where singleton_key = 1;

insert into app_private.staff_members (
  id, facility_id, employee_lookup_hash, employee_number_hint, display_name,
  status
)
select
  '84848484-8484-4484-8484-848484848484', id, repeat('7', 64), '82',
  'Fictional Deletion Officer', 'active'
from app_private.facilities where singleton_key = 1;

insert into app_private.user_accounts (
  auth_user_id, staff_member_id, sign_in_alias, role, status,
  must_change_passcode
)
values
  (
    '81818181-8181-4181-8181-818181818181',
    '83838383-8383-4383-8383-838383838383',
    'deletion-admin-alias@example.invalid', 'administrator', 'active', false
  ),
  (
    '82828282-8282-4282-8282-828282828282',
    '84848484-8484-4484-8484-848484848484',
    'deletion-officer-alias@example.invalid', 'officer', 'active', false
  );

insert into app_private.incidents (
  id, facility_id, created_by_account_id, incident_number, display_name,
  status, occurred_at, category, archived_at
)
select
  '85858585-8585-4585-8585-858585858585', id,
  '81818181-8181-4181-8181-818181818181',
  'FICTIONAL-DELETION-1', 'Fictional deletion package', 'archived',
  timestamptz '2023-12-01 12:00:00+00', 'fictional',
  timestamptz '2024-01-01 12:00:00+00'
from app_private.facilities where singleton_key = 1;

insert into app_private.incident_revisions (
  id, incident_id, revision_number, editor_account_id, schema_version,
  field_notes, reviewed_facts
)
values (
  '86868686-8686-4686-8686-868686868686',
  '85858585-8585-4585-8585-858585858585', 1,
  '81818181-8181-4181-8181-818181818181', 1, '[]'::jsonb, '[]'::jsonb
);

insert into app_private.reports (
  id, incident_id, report_type, reporting_account_id, prepared_by_account_id,
  status, archived_at
)
values (
  '87878787-8787-4787-8787-878787878787',
  '85858585-8585-4585-8585-858585858585', 'first_person',
  '81818181-8181-4181-8181-818181818181',
  '81818181-8181-4181-8181-818181818181', 'archived',
  timestamptz '2024-01-02 12:00:00+00'
);

insert into app_private.report_access (
  report_id, account_id, relationship, granted_by_account_id
)
values (
  '87878787-8787-4787-8787-878787878787',
  '81818181-8181-4181-8181-818181818181', 'owner',
  '81818181-8181-4181-8181-818181818181'
);

insert into app_private.report_draft_candidates (
  id, incident_id, source_incident_revision_id, requested_by_account_id,
  reporting_staff_member_id, report_type, source_fact_ids, paragraphs,
  provider_key
)
values (
  '88888888-8888-4888-8888-888888888888',
  '85858585-8585-4585-8585-858585858585',
  '86868686-8686-4686-8686-868686868686',
  '81818181-8181-4181-8181-818181818181',
  '83838383-8383-4383-8383-838383838383',
  'first_person',
  array['89898989-8989-4989-8989-898989898989'::uuid],
  '[{"text":"Fictional reviewed draft.","sourceFactIds":["89898989-8989-4989-8989-898989898989"]}]'::jsonb,
  'fictional.provider'
);

insert into app_private.report_revisions (
  id, report_id, revision_number, editor_account_id,
  source_incident_revision_id, narrative, schema_version, provenance
)
values (
  '90909090-9090-4090-8090-909090909090',
  '87878787-8787-4787-8787-878787878787', 1,
  '81818181-8181-4181-8181-818181818181',
  '86868686-8686-4686-8686-868686868686',
  'Fictional finalized report narrative.', 1,
  '{"draft_candidate_id":"88888888-8888-4888-8888-888888888888"}'::jsonb
);

insert into app_private.paperwork_records (
  id, facility_id, kind, work_date, shift_code, created_by_account_id,
  archived_at
)
select
  '91919191-9191-4191-8191-919191919191', id, 'count_sheet',
  date '2023-12-31', 'A',
  '81818181-8181-4181-8181-818181818181',
  timestamptz '2024-01-03 12:00:00+00'
from app_private.facilities where singleton_key = 1;

insert into app_private.record_artifacts (
  id, facility_id, record_type, record_id, artifact_kind, storage_bucket,
  storage_path, media_type, byte_size, sha256, created_by_account_id
)
select
  '92929292-9292-4292-8292-929292929292', facility.id, 'report',
  '87878787-8787-4787-8787-878787878787', 'generated_export',
  'generated-exports',
  facility.id::text || '/report/87878787-8787-4787-8787-878787878787/'
    || 'fictional-report.pdf',
  'application/pdf', 128, repeat('a', 64),
  '81818181-8181-4181-8181-818181818181'
from app_private.facilities as facility where singleton_key = 1;

select is(
  (
    select artifact_count
    from app_private.retention_artifact_manifest(
      (select id from app_private.facilities where singleton_key = 1),
      'incident', '85858585-8585-4585-8585-858585858585'
    )
  ),
  1,
  'the incident package manifest includes its report export'
);

select throws_ok(
  $$
    delete from app_private.incident_revisions
    where id = '86868686-8686-4686-8686-868686868686'
  $$,
  'Rows in app_private.incident_revisions are append-only',
  'immutable revisions still reject direct deletion'
);

select throws_ok(
  $$
    select app_private.approve_retention_deletion(
      '82828282-8282-4282-8282-828282828282',
      'incident', '85858585-8585-4585-8585-858585858585',
      'FICTIONAL-AUTHORITY-001', 'FICTIONAL-DB-BACKUP-001',
      'FICTIONAL-STORAGE-BACKUP-001', repeat('b', 64),
      statement_timestamp() - interval '1 hour',
      statement_timestamp() + interval '2 days'
    )
  $$,
  'Current active administrator required',
  'an officer cannot approve deletion'
);

select throws_ok(
  $$
    select app_private.approve_retention_deletion(
      '81818181-8181-4181-8181-818181818181',
      'report', '87878787-8787-4787-8787-878787878787',
      'FICTIONAL-AUTHORITY-001', 'FICTIONAL-DB-BACKUP-001',
      'FICTIONAL-STORAGE-BACKUP-001', repeat('b', 64),
      statement_timestamp() - interval '1 hour',
      statement_timestamp() + interval '2 days'
    )
  $$,
  'Invalid retention deletion approval evidence',
  'a report cannot be deleted outside its complete incident package'
);

select throws_ok(
  $$
    select app_private.approve_retention_deletion(
      '81818181-8181-4181-8181-818181818181',
      'incident', '85858585-8585-4585-8585-858585858585',
      'FICTIONAL-AUTHORITY-001', 'FICTIONAL-DB-BACKUP-001',
      'FICTIONAL-STORAGE-BACKUP-001', repeat('b', 64),
      statement_timestamp() - interval '1 hour',
      statement_timestamp() + interval '12 hours'
    )
  $$,
  'Invalid retention deletion approval evidence',
  'backup evidence must remain available beyond the approval window'
);

select throws_ok(
  $$
    select app_private.approve_retention_deletion(
      '81818181-8181-4181-8181-818181818181',
      'incident', '85858585-8585-4585-8585-858585858585',
      'FICTIONAL-AUTHORITY-001', 'FICTIONAL-DB-BACKUP-001',
      'FICTIONAL-STORAGE-BACKUP-001', repeat('b', 64),
      statement_timestamp() - interval '25 hours',
      statement_timestamp() + interval '2 days'
    )
  $$,
  'Invalid retention deletion approval evidence',
  'backup restore evidence must be from the prior 24 hours'
);

insert into app_private.retention_deletion_requests (
  id, facility_id, record_type, record_id, authority_reference,
  database_backup_reference, storage_backup_reference, backup_manifest_sha256,
  backup_verified_at, backup_expires_at, artifact_manifest_sha256,
  artifact_count, approved_by_account_id, approved_at, approval_expires_at
)
select
  '93939393-9393-4393-8393-939393939393', facility.id, 'incident',
  '85858585-8585-4585-8585-858585858585', 'FICTIONAL-EXPIRED-AUTHORITY',
  'FICTIONAL-EXPIRED-DB-BACKUP', 'FICTIONAL-EXPIRED-STORAGE-BACKUP',
  repeat('e', 64), statement_timestamp() - interval '49 hours',
  statement_timestamp() + interval '2 days',
  'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  0, '81818181-8181-4181-8181-818181818181',
  statement_timestamp() - interval '48 hours',
  statement_timestamp() - interval '24 hours'
from app_private.facilities as facility
where facility.singleton_key = 1;

select lives_ok(
  $$
    select set_config(
      'app.test.deletion_request_id',
      app_private.approve_retention_deletion(
        '81818181-8181-4181-8181-818181818181',
        'incident', '85858585-8585-4585-8585-858585858585',
        'FICTIONAL-AUTHORITY-001', 'FICTIONAL-DB-BACKUP-001',
        'FICTIONAL-STORAGE-BACKUP-001', repeat('b', 64),
        statement_timestamp() - interval '1 hour',
        statement_timestamp() + interval '2 days'
      )::text,
      true
    )
  $$,
  'an administrator can approve an eligible package with backup evidence'
);

select is(
  (
    select status from app_private.retention_deletion_requests
    where id = '93939393-9393-4393-8393-939393939393'
  ),
  'canceled',
  'a replacement approval preserves an expired approval as canceled evidence'
);
select is(
  (
    select count(*)::integer from app_private.audit_events
    where target_id = '93939393-9393-4393-8393-939393939393'
      and event_type = 'retention.deletion.canceled'
      and metadata = '{"reason_code":"approval_expired"}'::jsonb
  ),
  1,
  'expiration cancellation records only a bounded reason code'
);

select is(
  (
    select status from app_private.retention_deletion_requests
    where id = current_setting('app.test.deletion_request_id')::uuid
  ),
  'approved',
  'approval records metadata without starting deletion'
);
select is(
  (
    select count(*)::integer from app_private.incidents
    where id = '85858585-8585-4585-8585-858585858585'
  ),
  1,
  'approval alone does not delete the source record'
);
select is(
  (
    select count(*)::integer
    from app_private.list_retention_deletion_requests(
      '81818181-8181-4181-8181-818181818181', false, 100
    )
    where request_id = current_setting('app.test.deletion_request_id')::uuid
  ),
  1,
  'the approving facility administrator can list pending deletion evidence'
);
select is(
  (
    select approval_current
    from app_private.list_retention_deletion_requests(
      '81818181-8181-4181-8181-818181818181', false, 100
    )
    where request_id = current_setting('app.test.deletion_request_id')::uuid
  ),
  true,
  'the private register reports whether an approval is still executable'
);
select throws_ok(
  $$
    select * from app_private.list_retention_deletion_requests(
      '82828282-8282-4282-8282-828282828282', true, 100
    )
  $$,
  'Current active administrator required',
  'an officer cannot list deletion evidence'
);
select is(
  (
    select count(*)::integer
    from app_private.list_retention_deletion_artifacts(
      '81818181-8181-4181-8181-818181818181',
      current_setting('app.test.deletion_request_id')::uuid
    )
  ),
  1,
  'the private execution manifest returns the exact registered artifact'
);
select throws_ok(
  $$
    select app_private.complete_retention_deletion(
      '81818181-8181-4181-8181-818181818181',
      current_setting('app.test.deletion_request_id')::uuid
    )
  $$,
  'Active same-transaction deletion execution required',
  'completion cannot skip the locked execution start'
);
select lives_ok(
  $$
    select app_private.begin_retention_deletion(
      '81818181-8181-4181-8181-818181818181',
      current_setting('app.test.deletion_request_id')::uuid,
      '85858585-8585-4585-8585-858585858585'
    )
  $$,
  'execution starts only after locking and rechecking the complete package'
);
select lives_ok(
  $$
    select app_private.mark_retention_artifact_deleted(
      '81818181-8181-4181-8181-818181818181',
      current_setting('app.test.deletion_request_id')::uuid,
      '92929292-9292-4292-8292-929292929292'
    )
  $$,
  'verified Storage removal can be recorded inside the locked transaction'
);
select lives_ok(
  $$
    select app_private.verify_retention_artifact_cleanup(
      '81818181-8181-4181-8181-818181818181',
      current_setting('app.test.deletion_request_id')::uuid,
      (select artifact_manifest_sha256
        from app_private.retention_deletion_requests
        where id = current_setting('app.test.deletion_request_id')::uuid),
      0
    )
  $$,
  'zero remaining Storage objects and the matching manifest are required'
);
select lives_ok(
  $$
    select app_private.complete_retention_deletion(
      '81818181-8181-4181-8181-818181818181',
      current_setting('app.test.deletion_request_id')::uuid
    )
  $$,
  'the same locked transaction completes controlled database deletion'
);

select is(
  (
    select count(*)::integer from app_private.incidents
    where id = '85858585-8585-4585-8585-858585858585'
  ),
  0,
  'the incident head is deleted'
);
select is(
  (
    select count(*)::integer
    from app_private.incident_revisions
    where incident_id = '85858585-8585-4585-8585-858585858585'
  ),
  0,
  'the incident revision history is deleted only by the controlled path'
);
select is(
  (
    select count(*)::integer from app_private.reports
    where incident_id = '85858585-8585-4585-8585-858585858585'
  ),
  0,
  'all reports in the incident package are deleted'
);
select is(
  (
    select count(*)::integer from app_private.report_draft_candidates
    where incident_id = '85858585-8585-4585-8585-858585858585'
  ),
  0,
  'review-only draft candidates in the package are deleted'
);
select is(
  (
    select status from app_private.retention_deletion_requests
    where id = current_setting('app.test.deletion_request_id')::uuid
  ),
  'completed',
  'metadata-only deletion evidence remains completed'
);
select is(
  (
    select count(*)::integer from app_private.record_artifacts
    where deletion_request_id = current_setting('app.test.deletion_request_id')::uuid
      and deleted_at is not null
  ),
  1,
  'artifact integrity and deletion evidence remain without object bytes'
);
select is(
  (
    select count(*)::integer from app_private.audit_events
    where target_id = current_setting('app.test.deletion_request_id')::uuid
      and event_type in (
        'retention.deletion.approved', 'retention.deletion.completed'
      )
  ),
  2,
  'approval and completion create allowlisted audit events'
);
select is(
  (
    select count(*)::integer from app_private.audit_events
    where target_id = current_setting('app.test.deletion_request_id')::uuid
      and metadata ?| array[
        'authority_reference', 'database_backup_reference',
        'storage_backup_reference', 'storage_path'
      ]
  ),
  0,
  'audit events do not copy authority, backup, or object-path evidence'
);

select lives_ok(
  $$
    select set_config(
      'app.test.hold_id',
      app_private.place_legal_hold(
        '81818181-8181-4181-8181-818181818181',
        'paperwork_record', '91919191-9191-4191-8191-919191919191',
        'FICTIONAL-PAPERWORK-HOLD-001'
      )::text,
      true
    )
  $$,
  'a hold can protect an otherwise eligible paperwork record'
);
select throws_ok(
  $$
    select app_private.approve_retention_deletion(
      '81818181-8181-4181-8181-818181818181',
      'paperwork_record', '91919191-9191-4191-8191-919191919191',
      'FICTIONAL-AUTHORITY-002', 'FICTIONAL-DB-BACKUP-002',
      'FICTIONAL-STORAGE-BACKUP-002', repeat('d', 64),
      statement_timestamp() - interval '1 hour',
      statement_timestamp() + interval '2 days'
    )
  $$,
  'Retention target is not eligible or is protected by a hold',
  'a legal hold blocks deletion approval before any mutation starts'
);

select * from finish();
rollback;
