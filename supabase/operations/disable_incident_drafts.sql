-- Execute with psql --single-transaction under the controlled rollback procedure.
-- Containment only: preserve the table, payloads, lifecycle and audit history.
revoke all on function api.list_incident_drafts(integer) from public,anon,authenticated,service_role;
revoke all on function api.get_incident_draft(uuid) from public,anon,authenticated,service_role;
revoke all on function api.save_incident_draft(uuid,integer,smallint,jsonb,text,text,text) from public,anon,authenticated,service_role;
revoke all on function api.discard_incident_draft(uuid,integer) from public,anon,authenticated,service_role;
revoke all on function api.mark_incident_draft_promoted(uuid,uuid) from public,anon,authenticated,service_role;
revoke all on function api.create_incident_from_draft(uuid,integer,uuid,text,text,timestamptz,text,integer,jsonb,jsonb,jsonb,text,text) from public,anon,authenticated,service_role;
