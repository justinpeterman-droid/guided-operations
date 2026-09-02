begin;

select plan(8);

select ok(exists (select 1 from supabase_migrations.schema_migrations where version = '20260902090000'), 'feedback intake is delivered by a forward migration');
select ok(has_table_privilege('anon', 'app_private.improvement_requests', 'select') = false and has_table_privilege('authenticated', 'app_private.improvement_requests', 'select') = false, 'browser roles have no direct request-table access');
select ok(has_table_privilege('anon', 'app_private.form_candidate_files', 'select') = false and has_table_privilege('authenticated', 'app_private.form_candidate_files', 'select') = false, 'browser roles have no direct candidate-file access');
select ok(has_function_privilege('authenticated', 'api.create_improvement_request(uuid,text,text,text,text,text,text,text,integer,integer,text,text,text,text,text,text,bigint,text)', 'execute'), 'authenticated sessions can use the narrow create RPC');
select ok(not has_function_privilege('anon', 'api.create_improvement_request(uuid,text,text,text,text,text,text,text,integer,integer,text,text,text,text,text,text,bigint,text)', 'execute'), 'anonymous sessions cannot use the create RPC');
select ok(has_function_privilege('authenticated', 'api.transition_improvement_request(uuid,text,text,text)', 'execute') and not has_function_privilege('anon', 'api.transition_improvement_request(uuid,text,text,text)', 'execute'), 'only authenticated sessions can request constrained transitions');
select ok(exists (select 1 from storage.buckets where id = 'form-candidate-quarantine' and public = false and file_size_limit = 10485760), 'private bounded candidate quarantine bucket exists');
select is((select count(*)::integer from storage.objects where bucket_id = 'form-candidate-quarantine'), 0, 'new quarantine bucket has no seeded content');

select * from finish();
rollback;
