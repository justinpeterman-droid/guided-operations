begin;
select no_plan();
-- All records in this rollback-only test are fictional. The production marker
-- exercises the environment guard; no hosted project or real source is used.

    insert into app_private.policy_documents (
      id, facility_id, stable_key, title, collection, status
    )
    select
      '10101010-1010-4010-8010-101010101010',
      facility.id,
      'fictional-provenance-policy',
      'Fictional Provenance Policy',
      'BMU Post Orders',
      'approved'
    from app_private.facilities as facility
    limit 1;

    insert into app_private.staff_members (
      id, facility_id, employee_lookup_hash, employee_number_hint,
      display_name, status
    )
    select
      '15151515-1515-4515-8515-151515151515',
      facility.id,
      repeat('0', 64),
      'FICT-01',
      'Fictional Policy Reviewer',
      'active'
    from app_private.facilities as facility
    limit 1;

    insert into app_private.policy_document_versions (
      id, document_id, version_label, source_sha256, storage_path, media_type,
      page_count, approved_at, indexed_at, source_filename, byte_size,
      rights_status, rights_evidence_ref, rights_reviewed_by,
      rights_reviewed_at, allowed_processing_regions,
      external_ai_allowed, lifecycle_status, is_current
    ) values (
      '20202020-2020-4020-8020-202020202020',
      '10101010-1010-4010-8010-101010101010',
      'fictional-v1',
      repeat('1', 64),
      'fictional-provenance/' || repeat('1', 64) || '.pdf',
      'application/pdf',
      2,
      statement_timestamp(),
      statement_timestamp(),
      'fictional-provenance-policy.pdf',
      2048,
      'approved_internal_search',
      'fictional-rights-evidence',
      '15151515-1515-4515-8515-151515151515',
      statement_timestamp(),
      array['us-east-1'],
      true,
      'active',
      true
    );

    insert into app_private.policy_ingestion_runs (
      id, document_version_id, environment, source_sha256,
      collection, extraction_provider, extraction_tool, extraction_version,
      extraction_config_sha256, normalization_version, chunking_version,
      chunking_config_sha256, chunking_configuration, code_commit_sha,
      dependency_lock_sha256
    ) values (
      '30303030-3030-4030-8030-303030303030',
      '20202020-2020-4020-8020-202020202020',
      'production',
      repeat('1', 64),
      'BMU Post Orders',
      'mineru',
      'fictional-parser',
      'fictional-v1',
      repeat('2', 64),
      'fictional-normalization-v1',
      'fictional-chunking-v1',
      repeat('a', 64),
      jsonb_build_object('max_pages', 2),
      repeat('3', 40),
      repeat('4', 64)
    );

    insert into app_private.policy_pages (
      document_version_id, ingestion_run_id, source_page_index,
      normalized_text, normalized_text_sha256, extraction_mode, review_status
    ) values
      (
        '20202020-2020-4020-8020-202020202020',
        '30303030-3030-4030-8030-303030303030',
        1,
        'Fictional first page.',
        repeat('5', 64),
        'native',
        'approved'
      ),
      (
        '20202020-2020-4020-8020-202020202020',
        '30303030-3030-4030-8030-303030303030',
        2,
        'Fictional second page.',
        repeat('6', 64),
        'native',
        'approved'
      );

    insert into app_private.policy_chunks (
      id, document_version_id, ingestion_run_id, ordinal, page_start, page_end,
      content, content_sha256, lifecycle_status, qa_approved
    ) values (
      '40404040-4040-4040-8040-404040404040',
      '20202020-2020-4020-8020-202020202020',
      '30303030-3030-4030-8030-303030303030',
      0,
      1,
      2,
      'Fictional bounded policy passage.',
      repeat('7', 64),
      'active',
      true
    );

    update app_private.policy_ingestion_runs
    set status = 'ready',
        qa_status = 'approved',
        qa_reviewed_by = '15151515-1515-4515-8515-151515151515',
        qa_reviewed_at = statement_timestamp(),
        completed_at = statement_timestamp(),
        page_count = 2,
        chunk_count = 1
    where id = '30303030-3030-4030-8030-303030303030';
  
update app_private.policy_ingestion_runs set status = 'awaiting_review', qa_status = 'pending',
  qa_reviewed_by = null, qa_reviewed_at = null where id = '30303030-3030-4030-8030-303030303030';
update app_private.policy_pages set normalized_text_sha256 = encode(extensions.digest(normalized_text, 'sha256'), 'hex'),
  review_status = 'pending' where ingestion_run_id = '30303030-3030-4030-8030-303030303030';
update app_private.policy_chunks set content_sha256 = encode(extensions.digest(content, 'sha256'), 'hex'),
  qa_approved = false, lifecycle_status = 'pending' where ingestion_run_id = '30303030-3030-4030-8030-303030303030';
update app_private.policy_document_versions set approved_at = null, indexed_at = null, lifecycle_status = 'pending',
  rights_review_due_at = statement_timestamp() + interval '1 year' where id = '20202020-2020-4020-8020-202020202020';
insert into auth.users(id,email) values ('aaaaaaaa-0000-4000-8000-000000000071','fictional-policy-owner@example.invalid');
insert into app_private.user_accounts(auth_user_id, staff_member_id, sign_in_alias, role, status, must_change_passcode)
values ('aaaaaaaa-0000-4000-8000-000000000071','15151515-1515-4515-8515-151515151515',
  'fictional-policy-owner-alias@example.invalid','administrator','active',false);
insert into auth.sessions(id,user_id) values ('bbbbbbbb-0000-4000-8000-000000000071','aaaaaaaa-0000-4000-8000-000000000071');

create function pg_temp.snapshot() returns jsonb language sql as $$
  select app_private.policy_review_snapshot('aaaaaaaa-0000-4000-8000-000000000071',
    'bbbbbbbb-0000-4000-8000-000000000071',1,
    '20202020-2020-4020-8020-202020202020','30303030-3030-4030-8030-303030303030');
$$;
create temporary table review_fixture as select pg_temp.snapshot() || jsonb_build_object(
  'reviewId','cccccccc-0000-4000-8000-000000000071','sourceReviewed',true,'reviewRecordSha256',repeat('d',64),
  'pages',(select jsonb_agg(p || '{"reviewed":true}'::jsonb) from jsonb_array_elements(pg_temp.snapshot()->'pages') p),
  'chunks',(select jsonb_agg(c || '{"reviewed":true}'::jsonb) from jsonb_array_elements(pg_temp.snapshot()->'chunks') c)
) as review;
create function pg_temp.approve(p_review jsonb) returns text language sql as $$
  select app_private.approve_policy_review('aaaaaaaa-0000-4000-8000-000000000071',
    'bbbbbbbb-0000-4000-8000-000000000071',1,p_review,
    'dddddddd-0000-4000-8000-000000000071',repeat('t',43));
$$;
create function pg_temp.proof() returns uuid language sql as $$
  select app_private.issue_admin_step_up('aaaaaaaa-0000-4000-8000-000000000071',
    'bbbbbbbb-0000-4000-8000-000000000071',1,'policy.review',repeat('t',43),
    'dddddddd-0000-4000-8000-000000000071',statement_timestamp()+interval '5 minutes');
$$;
select ok(pg_temp.snapshot()::text not like '%Fictional%' and pg_temp.snapshot()::text not like '%storage_path%',
  'snapshot exports hashes and opaque IDs only');
select ok(not has_function_privilege('anon','app_private.policy_review_snapshot(uuid,uuid,integer,uuid,uuid)','execute')
  and not has_function_privilege('authenticated','app_private.policy_review_snapshot(uuid,uuid,integer,uuid,uuid)','execute')
  and not has_function_privilege('service_role','app_private.policy_review_snapshot(uuid,uuid,integer,uuid,uuid)','execute'),
  'snapshot has no Data API execution grant');
select ok(not has_function_privilege('anon','app_private.approve_policy_review(uuid,uuid,integer,jsonb,uuid,text)','execute')
  and not has_function_privilege('authenticated','app_private.approve_policy_review(uuid,uuid,integer,jsonb,uuid,text)','execute')
  and not has_function_privilege('service_role','app_private.approve_policy_review(uuid,uuid,integer,jsonb,uuid,text)','execute'),
  'approval has no Data API execution grant');
select throws_ok($$select pg_temp.approve(review) from review_fixture$$,'42501','Policy review denied','missing proof cannot approve');
select pg_temp.proof();
select throws_ok($$select pg_temp.approve(review || '{"actor":"forged"}'::jsonb) from review_fixture$$,
  '40001','Policy review evidence changed','caller identity/unknown manifest fields rejected');
select throws_ok($$select pg_temp.approve(jsonb_set(review,'{pages,0,reviewed}','false')) from review_fixture$$,
  '22023','Incomplete policy review','every page needs explicit human review');
select throws_ok($$select pg_temp.approve(jsonb_set(review,'{chunks,0,reviewed}','false')) from review_fixture$$,
  '22023','Incomplete policy review','every chunk needs explicit human review');
select throws_ok($$select pg_temp.approve(jsonb_set(review,'{pages}',review->'pages' - 0)) from review_fixture$$,
  '40001','Policy review evidence changed','missing reviewed page rejected');
select throws_ok($$select pg_temp.approve(jsonb_set(review,'{pages}',(review->'pages') || (review->'pages'->0))) from review_fixture$$,
  '40001','Policy review evidence changed','duplicate page rejected');
select throws_ok($$select pg_temp.approve(jsonb_set(review,'{sourceReviewed}','false')) from review_fixture$$,
  '22023','Invalid policy review','source review required');
select throws_ok($$select pg_temp.approve(jsonb_set(review,'{reviewRecordSha256}','null')) from review_fixture$$,
  '22023','Invalid policy review','private review evidence required');
select throws_ok($$update app_private.policy_pages set warning_codes = array['fictional-warning'] where source_page_index=1
  and ingestion_run_id='30303030-3030-4030-8030-303030303030'; select pg_temp.approve(review) from review_fixture$$,
  '40001','Policy review evidence changed','changed warning invalidates prior manifest');
select throws_ok($$update app_private.policy_pages set normalized_text = 'Fictional changed text' where source_page_index=1
  and ingestion_run_id='30303030-3030-4030-8030-303030303030'; select pg_temp.snapshot()$$,
  '22023','Policy evidence blocked','stored page hash mismatch blocked');
select throws_ok($$update app_private.policy_chunks set content_sha256=repeat('f',64)
  where id='40404040-4040-4040-8040-404040404040'; select pg_temp.snapshot()$$,
  '22023','Policy evidence blocked','stored chunk hash mismatch blocked');
select throws_ok($$update app_private.policy_pages set review_status='rejected' where source_page_index=1
  and ingestion_run_id='30303030-3030-4030-8030-303030303030'; select pg_temp.snapshot()$$,
  '22023','Policy evidence blocked','rejected page cannot be bulk revived');
select throws_ok($$update app_private.policy_document_versions set rights_review_due_at=statement_timestamp()+interval '1 second'
  where id='20202020-2020-4020-8020-202020202020'; select pg_temp.approve(review) from review_fixture$$,
  '40001','Policy review evidence changed','changed rights evidence invalidates review');
select throws_ok($$update app_private.policy_document_versions set external_ai_allowed=false
  where id='20202020-2020-4020-8020-202020202020'; select pg_temp.snapshot()$$,
  '22023','Policy evidence blocked','provider disallowance blocks approval');
select throws_ok($$update app_private.user_accounts set role='officer' where auth_user_id='aaaaaaaa-0000-4000-8000-000000000071';
  select pg_temp.snapshot()$$,'42501','Policy review denied','officer denied');
select throws_ok($$update app_private.user_accounts set status='disabled' where auth_user_id='aaaaaaaa-0000-4000-8000-000000000071';
  select pg_temp.snapshot()$$,'42501','Policy review denied','disabled account denied');
select throws_ok($$update app_private.user_accounts set must_change_passcode=true where auth_user_id='aaaaaaaa-0000-4000-8000-000000000071';
  select pg_temp.snapshot()$$,'42501','Policy review denied','forced passcode change denied');
select throws_ok($$update app_private.user_accounts set auth_version=2 where auth_user_id='aaaaaaaa-0000-4000-8000-000000000071';
  select pg_temp.snapshot()$$,'42501','Policy review denied','stale auth version denied');
select throws_ok($$delete from auth.sessions where id='bbbbbbbb-0000-4000-8000-000000000071'; select pg_temp.snapshot()$$,
  '42501','Policy review denied','revoked provider session denied');
select throws_ok($$update auth.sessions set not_after=statement_timestamp()-interval '1 second'
  where id='bbbbbbbb-0000-4000-8000-000000000071'; select pg_temp.snapshot()$$,
  '42501','Policy review denied','expired provider session denied');
select throws_ok($$update app_private.admin_step_ups set purpose='policy.promote' where token_digest=repeat('t',43);
  select pg_temp.approve(review) from review_fixture$$,'42501','Policy review denied','activation proof cannot approve QA');
select throws_ok($$update app_private.admin_step_ups set issued_at=statement_timestamp()-interval '10 minutes',
  expires_at=statement_timestamp()-interval '1 second' where token_digest=repeat('t',43);
  select pg_temp.approve(review) from review_fixture$$,'42501','Policy review denied','expired step-up denied');
select throws_ok($$update app_private.policy_document_versions set rights_reviewed_at=statement_timestamp()-interval '2 years',
  rights_review_due_at=statement_timestamp()-interval '1 year' where id='20202020-2020-4020-8020-202020202020';
  select pg_temp.snapshot()$$,'22023','Policy evidence blocked','expired rights denied');
select throws_ok($$update app_private.policy_document_versions set indexed_at=statement_timestamp()
  where id='20202020-2020-4020-8020-202020202020'; select pg_temp.snapshot()$$,
  '22023','Policy evidence blocked','mixed activation markers denied');
select throws_ok($$insert into app_private.staff_members(id,facility_id,employee_lookup_hash,employee_number_hint,display_name,status)
  select 'eeeeeeee-0000-4000-8000-000000000071',id,repeat('e',64),'FICT-OTHER','Fictional other reviewer','active'
  from app_private.facilities;
  update app_private.policy_document_versions set rights_reviewed_by='eeeeeeee-0000-4000-8000-000000000071'
  where id='20202020-2020-4020-8020-202020202020'; select pg_temp.snapshot()$$,
  '42501','Policy review denied','administrator status alone does not grant owner review authority');
select is((select consumed_at is null from app_private.admin_step_ups where token_digest=repeat('t',43)),true,
  'failed transactions preserve unconsumed proof');
select is((select pg_temp.approve(review) from review_fixture),'approved_for_embedding','review approves exact staged evidence');
select is((select qa_reviewed_by::text from app_private.policy_ingestion_runs where id='30303030-3030-4030-8030-303030303030'),
  '15151515-1515-4515-8515-151515151515','QA reviewer is derived from authenticated account');
select ok((select lifecycle_status='pending' and indexed_at is null and approved_at is not null
  from app_private.policy_document_versions where id='20202020-2020-4020-8020-202020202020'), 'approval preserves search activation boundary');
select is((select count(*)::integer from app_private.audit_events where event_id='cccccccc-0000-4000-8000-000000000071'),1,
  'approval records exactly one append-only receipt');
select ok((select metadata::text not like '%Fictional%' and metadata::text not like '%normalized_text%'
  from app_private.audit_events where event_id='cccccccc-0000-4000-8000-000000000071'), 'receipt contains no source text');
select throws_ok($$select pg_temp.approve(review) from review_fixture$$,'42501','Policy review denied','consumed proof cannot replay');
-- A newly authenticated retry uses a fresh proof and the same exact review ID.
update app_private.admin_step_ups set token_digest=repeat('z',43) where token_digest=repeat('t',43);
select pg_temp.proof();
select is((select pg_temp.approve(review) from review_fixture),'already_approved','fresh authenticated retry is idempotent');
select is((select count(*)::integer from app_private.audit_events where event_id='cccccccc-0000-4000-8000-000000000071'),1,
  'retry does not create a second receipt');
select * from finish();
rollback;
