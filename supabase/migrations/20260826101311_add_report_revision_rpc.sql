begin;
create or replace function api.append_report_revision(
 p_report_id uuid,p_base_revision_number integer,p_narrative text,p_reason text,
 p_idempotency_key_digest text,p_request_digest text
) returns integer language plpgsql security definer set search_path='' as $$
declare r app_private.reports%rowtype; role text; facility uuid; prior text; prior_result uuid;
begin
 select a.role::text,s.facility_id into role,facility from app_private.user_accounts a join app_private.staff_members s on s.id=a.staff_member_id where a.auth_user_id=auth.uid() and a.status='active' and s.status='active';
 select report.* into r from app_private.reports report join app_private.incidents i on i.id=report.incident_id where report.id=p_report_id and report.archived_at is null and i.archived_at is null and i.facility_id=facility and (role='administrator' or exists(select 1 from app_private.report_access x where x.report_id=report.id and x.account_id=auth.uid() and x.revoked_at is null)) for update;
 if not found then raise exception using errcode='42501',message='Not authorized to revise this report'; end if;
 if p_base_revision_number<>r.current_revision_number then raise exception using errcode='40001',message='Report revision conflict'; end if;
 if coalesce(char_length(p_narrative),0) not between 1 and 50000 or coalesce(char_length(p_reason),0) not between 1 and 500 or p_idempotency_key_digest !~ '^[a-f0-9]{64}$' or p_request_digest !~ '^[a-f0-9]{64}$' then raise exception using errcode='22023',message='Invalid report revision request'; end if;
 select request_digest,result_reference_id into prior,prior_result from app_private.idempotency_records where actor_account_id=auth.uid() and action='report.revise' and idempotency_key_digest=p_idempotency_key_digest for update;
 if found then if prior<>p_request_digest then raise exception using errcode='22023',message='Retry key was reused for a different request'; end if; if prior_result is not null then return r.current_revision_number; end if; raise exception using errcode='40001',message='Report revision is already in progress'; end if;
 insert into app_private.idempotency_records(actor_account_id,action,idempotency_key_digest,request_digest,expires_at) values(auth.uid(),'report.revise',p_idempotency_key_digest,p_request_digest,statement_timestamp()+interval '24 hours');
 insert into app_private.report_revisions(report_id,revision_number,editor_account_id,source_incident_revision_id,narrative,reason,schema_version,provenance) select r.id,r.current_revision_number+1,auth.uid(),source_incident_revision_id,p_narrative,p_reason,schema_version,jsonb_build_object('prior_revision_number',r.current_revision_number) from app_private.report_revisions where report_id=r.id and revision_number=r.current_revision_number;
 update app_private.idempotency_records set status='succeeded',result_reference_id=r.id,result_code='report.revised' where actor_account_id=auth.uid() and action='report.revise' and idempotency_key_digest=p_idempotency_key_digest;
 return r.current_revision_number+1;
end;$$;
revoke all on function api.append_report_revision(uuid,integer,text,text,text,text) from public,anon,service_role;
grant usage on schema api to authenticated;
grant execute on function api.append_report_revision(uuid,integer,text,text,text,text) to authenticated;
commit;
