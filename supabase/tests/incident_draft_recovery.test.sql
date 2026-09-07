begin;
select no_plan();
insert into auth.users(id,email) values ('a1000000-0000-4000-8000-000000000001','fictional-draft-one@example.invalid'),('a1000000-0000-4000-8000-000000000002','fictional-draft-two@example.invalid');
insert into app_private.staff_members(id,facility_id,employee_lookup_hash,employee_number_hint,display_name,status,shift_code)
select 'a2000000-0000-4000-8000-000000000001',id,repeat('a',64),'DF1','Fictional Draft One','active','A' from app_private.facilities;
insert into app_private.staff_members(id,facility_id,employee_lookup_hash,employee_number_hint,display_name,status,shift_code)
select 'a2000000-0000-4000-8000-000000000002',id,repeat('b',64),'DF2','Fictional Draft Two','active','A' from app_private.facilities;
insert into app_private.user_accounts(auth_user_id,staff_member_id,sign_in_alias,role,status,must_change_passcode) values
('a1000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001','fictional-draft-one-auth@example.invalid','officer','active',false),
('a1000000-0000-4000-8000-000000000002','a2000000-0000-4000-8000-000000000002','fictional-draft-two-auth@example.invalid','officer','active',false);
select set_config('app.test.draft_facility',(select id::text from app_private.facilities),true);
select ok(not has_table_privilege('authenticated','app_private.incident_drafts','select,insert,update,delete'),'clients have no direct table privileges');
select ok(not has_function_privilege('authenticated','api.mark_incident_draft_promoted(uuid,uuid)','execute'),'non-atomic promotion is inaccessible');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid='app_private.incident_drafts'::regclass),'draft RLS is forced');
set local role authenticated;
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"app_metadata":{"auth_version":1}}',true);
select is((select outcome from api.save_incident_draft('a3000000-0000-4000-8000-000000000001',0,1::smallint,'{"schemaVersion":1,"step":1,"officerConfirmed":false,"selectedRelationships":[],"factReportingScopes":{},"reportsReviewed":false,"incidentNumber":"","incidentName":"","occurredAt":"","location":"","category":"","categoryConfirmed":false,"notes":"","factProposals":[],"unknown":"","checklistAnswers":[]}',null,null,repeat('a',64))),'saved','first save succeeds');
select is((select revision_number from api.save_incident_draft('a3000000-0000-4000-8000-000000000001',0,1::smallint,'{"schemaVersion":1,"step":1,"officerConfirmed":false,"selectedRelationships":[],"factReportingScopes":{},"reportsReviewed":false,"incidentNumber":"","incidentName":"","occurredAt":"","location":"","category":"","categoryConfirmed":false,"notes":"","factProposals":[],"unknown":"","checklistAnswers":[]}',null,null,repeat('a',64))),1,'lost first response retries without a duplicate');
select is((select count(*)::int from api.list_incident_drafts()),1,'one draft exists after retry');
select is((select schema_version::int from api.get_incident_draft('a3000000-0000-4000-8000-000000000001')),1,'read returns schema version');
select is((select outcome from api.save_incident_draft('a3000000-0000-4000-8000-000000000001',0,1::smallint,'{"schemaVersion":1,"step":1,"officerConfirmed":false,"selectedRelationships":[],"factReportingScopes":{},"reportsReviewed":false,"incidentNumber":"","incidentName":"","occurredAt":"","location":"","category":"","categoryConfirmed":false,"notes":"changed","factProposals":[],"unknown":"","checklistAnswers":[]}',null,null,repeat('b',64))),'conflict','changed create retry cannot overwrite');
select is((select revision_number from api.save_incident_draft('a3000000-0000-4000-8000-000000000001',1,1::smallint,'{"schemaVersion":1,"step":1,"officerConfirmed":false,"selectedRelationships":[],"factReportingScopes":{},"reportsReviewed":false,"incidentNumber":"","incidentName":"","occurredAt":"","location":"","category":"","categoryConfirmed":false,"notes":"changed","factProposals":[],"unknown":"","checklistAnswers":[]}',null,null,repeat('b',64))),2,'revision update succeeds');
select is((select revision_number from api.save_incident_draft('a3000000-0000-4000-8000-000000000001',1,1::smallint,'{"schemaVersion":1,"step":1,"officerConfirmed":false,"selectedRelationships":[],"factReportingScopes":{},"reportsReviewed":false,"incidentNumber":"","incidentName":"","occurredAt":"","location":"","category":"","categoryConfirmed":false,"notes":"changed","factProposals":[],"unknown":"","checklistAnswers":[]}',null,null,repeat('b',64))),2,'lost update response retries safely');
select is((select outcome from api.save_incident_draft('a3000000-0000-4000-8000-000000000001',1,1::smallint,'{"schemaVersion":1,"step":1,"officerConfirmed":false,"selectedRelationships":[],"factReportingScopes":{},"reportsReviewed":false,"incidentNumber":"","incidentName":"","occurredAt":"","location":"","category":"","categoryConfirmed":false,"notes":"","factProposals":[],"unknown":"","checklistAnswers":[]}',null,null,repeat('c',64))),'conflict','stale update rejected');
select is(api.discard_incident_draft('a3000000-0000-4000-8000-000000000001',1),false,'stale tab cannot discard newer revision');
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000002',true);
select is((select count(*)::int from api.list_incident_drafts()),0,'other owner cannot list draft');
select is((select count(*)::int from api.get_incident_draft('a3000000-0000-4000-8000-000000000001')),0,'other owner cannot read draft');
select is((select outcome from api.save_incident_draft('a3000000-0000-4000-8000-000000000001',2,1::smallint,'{"schemaVersion":1,"step":1,"officerConfirmed":false,"selectedRelationships":[],"factReportingScopes":{},"reportsReviewed":false,"incidentNumber":"","incidentName":"","occurredAt":"","location":"","category":"","categoryConfirmed":false,"notes":"","factProposals":[],"unknown":"","checklistAnswers":[]}',null,null,repeat('c',64))),'conflict','other owner cannot save');
select is(api.discard_incident_draft('a3000000-0000-4000-8000-000000000001',2),false,'other owner cannot discard');
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"app_metadata":{"auth_version":2}}',true);
select is((select count(*)::int from api.list_incident_drafts()),0,'revoked session cannot list');
select is((select count(*)::int from api.get_incident_draft('a3000000-0000-4000-8000-000000000001')),0,'revoked session cannot read');
select is((select count(*)::int from api.save_incident_draft('a3000000-0000-4000-8000-000000000001',2,1::smallint,'{"schemaVersion":1,"step":1,"officerConfirmed":false,"selectedRelationships":[],"factReportingScopes":{},"reportsReviewed":false,"incidentNumber":"","incidentName":"","occurredAt":"","location":"","category":"","categoryConfirmed":false,"notes":"","factProposals":[],"unknown":"","checklistAnswers":[]}',null,null,repeat('c',64))),0,'revoked session cannot save');
select is(api.discard_incident_draft('a3000000-0000-4000-8000-000000000001',2),false,'revoked session cannot discard');
select set_config('request.jwt.claims','{"app_metadata":{"auth_version":1}}',true);
select throws_ok($$select api.create_incident_from_draft('a3000000-0000-4000-8000-000000000001',1,current_setting('app.test.draft_facility')::uuid,'FICTIONAL-DRAFT-001','Fictional draft promotion','2026-09-07T12:00:00Z','training',2,'[{"id":"a4000000-0000-4000-8000-000000000001","text":"Fictional note.","recordedAt":"2026-09-07T12:00:00Z"}]','[]','[{"staffMemberId":"a2000000-0000-4000-8000-000000000001","relationship":"preparer"},{"staffMemberId":"a2000000-0000-4000-8000-000000000001","relationship":"reporting_officer"}]',repeat('d',64),repeat('e',64))$$,'40001','Incident draft changed','stale promotion leaves incident and draft unchanged');
select lives_ok($$select api.create_incident_from_draft('a3000000-0000-4000-8000-000000000001',2,current_setting('app.test.draft_facility')::uuid,'FICTIONAL-DRAFT-001','Fictional draft promotion','2026-09-07T12:00:00Z','training',2,'[{"id":"a4000000-0000-4000-8000-000000000001","text":"Fictional note.","recordedAt":"2026-09-07T12:00:00Z"}]','[]','[{"staffMemberId":"a2000000-0000-4000-8000-000000000001","relationship":"preparer"},{"staffMemberId":"a2000000-0000-4000-8000-000000000001","relationship":"reporting_officer"}]',repeat('d',64),repeat('e',64))$$,'atomic promotion succeeds');
select lives_ok($$select api.create_incident_from_draft('a3000000-0000-4000-8000-000000000001',2,current_setting('app.test.draft_facility')::uuid,'FICTIONAL-DRAFT-001','Fictional draft promotion','2026-09-07T12:00:00Z','training',2,'[{"id":"a4000000-0000-4000-8000-000000000001","text":"Fictional note.","recordedAt":"2026-09-07T12:00:00Z"}]','[]','[{"staffMemberId":"a2000000-0000-4000-8000-000000000001","relationship":"preparer"},{"staffMemberId":"a2000000-0000-4000-8000-000000000001","relationship":"reporting_officer"}]',repeat('d',64),repeat('e',64))$$,'lost promotion response retries same incident');
select is((select count(*)::int from api.list_incident_drafts()),0,'promoted draft leaves work list');
select is(api.discard_incident_draft('a3000000-0000-4000-8000-000000000001',2),false,'promoted draft cannot be discarded');
reset role;
select is((select count(*)::int from app_private.incidents where incident_number='FICTIONAL-DRAFT-001'),1,'promotion retry made one incident');
select is((select lifecycle_status from app_private.incident_drafts where id='a3000000-0000-4000-8000-000000000001'),'promoted','promotion recorded atomically');
set local role authenticated;
select is((select outcome from api.save_incident_draft('a3000000-0000-4000-8000-000000000003',0,1::smallint,'{"schemaVersion":1,"step":1,"officerConfirmed":false,"selectedRelationships":[],"factReportingScopes":{},"reportsReviewed":false,"incidentNumber":"","incidentName":"","occurredAt":"","location":"","category":"","categoryConfirmed":false,"notes":"","factProposals":[],"unknown":"","checklistAnswers":[]}',null,null,repeat('f',64))),'saved','independent unfinished draft saves');
select is(api.discard_incident_draft('a3000000-0000-4000-8000-000000000003',1),true,'owner can discard matching revision');
select is(api.discard_incident_draft('a3000000-0000-4000-8000-000000000003',1),true,'discard retry is idempotent');
select is((select count(*)::int from api.get_incident_draft('a3000000-0000-4000-8000-000000000003')),0,'discarded draft is unavailable to owner');
reset role;
select is((select count(*)::int from app_private.incident_drafts where id='a3000000-0000-4000-8000-000000000003'),1,'discard retains payload for controlled retention');
select is((select confdeltype::text from pg_constraint where conname='incident_drafts_promoted_incident_id_fkey'),'c','promoted drafts follow controlled parent deletion');
select ok(not app_private.valid_incident_draft_payload('{}'), 'incomplete RPC envelope rejected');
select ok(not app_private.valid_incident_draft_payload('{"schemaVersion":1,"step":1,"officerConfirmed":false,"selectedRelationships":[],"factReportingScopes":{},"reportsReviewed":false,"incidentNumber":"","incidentName":"","occurredAt":"","location":"","category":"","categoryConfirmed":false,"notes":"","factProposals":[],"unknown":"","checklistAnswers":[]}'::jsonb || '{"step":9}'), 'invalid step rejected');
select ok(not app_private.valid_incident_draft_payload('{"schemaVersion":1,"step":1,"officerConfirmed":false,"selectedRelationships":[],"factReportingScopes":{},"reportsReviewed":false,"incidentNumber":"","incidentName":"","occurredAt":"","location":"","category":"","categoryConfirmed":false,"notes":"","factProposals":[],"unknown":"","checklistAnswers":[]}'::jsonb || '{"arbitrary":true}'), 'unknown keys rejected');
select ok(not app_private.valid_incident_draft_payload('{"schemaVersion":1,"step":1,"officerConfirmed":false,"selectedRelationships":[],"factReportingScopes":{},"reportsReviewed":false,"incidentNumber":"","incidentName":"","occurredAt":"","location":"","category":"","categoryConfirmed":false,"notes":"","factProposals":[],"unknown":"","checklistAnswers":[]}'::jsonb || jsonb_build_object('notes',repeat('x',20001))), 'oversized field rejected');
select ok(not app_private.valid_incident_draft_payload('{"schemaVersion":1,"step":1,"officerConfirmed":false,"selectedRelationships":[],"factReportingScopes":{},"reportsReviewed":false,"incidentNumber":"","incidentName":"","occurredAt":"","location":"","category":"","categoryConfirmed":false,"notes":"","factProposals":[],"unknown":"","checklistAnswers":[]}'::jsonb || '{"selectedRelationships":["a2000000-0000-4000-8000-000000000001:witness","a2000000-0000-4000-8000-000000000001:witness"]}'), 'duplicate relationships rejected');
select ok(not app_private.valid_incident_draft_payload('{"schemaVersion":1,"step":1,"officerConfirmed":false,"selectedRelationships":[],"factReportingScopes":{},"reportsReviewed":false,"incidentNumber":"","incidentName":"","occurredAt":"","location":"","category":"","categoryConfirmed":false,"notes":"","factProposals":[],"unknown":"","checklistAnswers":[]}'::jsonb || '{"checklistAnswers":[{"questionId":"ab","state":"unknown"},{"questionId":"ab","state":"not_applicable"}]}'), 'duplicate checklist answers rejected');
select set_config('app.test.draft_count',(select count(*)::text from app_private.incident_drafts),true);
-- BEGIN DRAFT CONTAINMENT
-- Execute with psql --single-transaction under the controlled rollback procedure.
-- Containment only: preserve the table, payloads, lifecycle and audit history.
revoke all on function api.list_incident_drafts(integer) from public,anon,authenticated,service_role;
revoke all on function api.get_incident_draft(uuid) from public,anon,authenticated,service_role;
revoke all on function api.save_incident_draft(uuid,integer,smallint,jsonb,text,text,text) from public,anon,authenticated,service_role;
revoke all on function api.discard_incident_draft(uuid,integer) from public,anon,authenticated,service_role;
revoke all on function api.mark_incident_draft_promoted(uuid,uuid) from public,anon,authenticated,service_role;
revoke all on function api.create_incident_from_draft(uuid,integer,uuid,text,text,timestamptz,text,integer,jsonb,jsonb,jsonb,text,text) from public,anon,authenticated,service_role;
-- END DRAFT CONTAINMENT
select ok(not has_function_privilege('authenticated','api.save_incident_draft(uuid,integer,smallint,jsonb,text,text,text)','execute'),'containment disables direct save');
select ok(not has_function_privilege('authenticated','api.get_incident_draft(uuid)','execute'),'containment disables resume');
select ok(not has_function_privilege('authenticated','api.create_incident_from_draft(uuid,integer,uuid,text,text,timestamptz,text,integer,jsonb,jsonb,jsonb,text,text)','execute'),'containment disables promotion');
select is((select count(*)::text from app_private.incident_drafts),current_setting('app.test.draft_count'),'containment preserves retained drafts');
select * from finish();
rollback;
