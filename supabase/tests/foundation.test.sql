begin;

select plan(24);

select has_schema('api', 'locked Data API schema exists');
select has_schema('app_private', 'app_private schema exists');
select has_table('app_private', 'facilities', 'facilities table exists');
select has_table('app_private', 'staff_members', 'staff_members table exists');
select has_table('app_private', 'user_accounts', 'user_accounts table exists');
select has_table('app_private', 'policy_documents', 'policy_documents table exists');
select has_table(
  'app_private',
  'policy_document_versions',
  'policy_document_versions table exists'
);
select has_table('app_private', 'policy_chunks', 'policy_chunks table exists');
select has_table(
  'app_private',
  'embedding_profiles',
  'embedding_profiles table exists'
);
select has_table(
  'app_private',
  'policy_chunk_embeddings',
  'policy_chunk_embeddings table exists'
);
select has_table('app_private', 'audit_events', 'audit_events table exists');

select is(
  (
    select namespace.nspname
    from pg_extension as extension
    join pg_namespace as namespace on namespace.oid = extension.extnamespace
    where extension.extname = 'pgcrypto'
  ),
  'extensions',
  'pgcrypto is installed in the extensions schema'
);

select is(
  (
    select namespace.nspname
    from pg_extension as extension
    join pg_namespace as namespace on namespace.oid = extension.extnamespace
    where extension.extname = 'vector'
  ),
  'extensions',
  'vector is installed in the extensions schema'
);

select is(
  (
    select count(*)::integer
    from pg_class as relation
    join pg_namespace as namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'app_private'
      and relation.relkind in ('r', 'p')
      and (not relation.relrowsecurity or not relation.relforcerowsecurity)
  ),
  0,
  'every application table enables and forces row-level security'
);

select is(
  (
    select count(*)::integer
    from information_schema.table_privileges
    where table_schema = 'app_private'
      and grantee in ('PUBLIC', 'anon', 'authenticated', 'service_role')
  ),
  0,
  'public and Data API roles have no direct application-table grants'
);

select is(
  (
    select count(*)::integer
    from information_schema.routine_privileges
    where routine_schema = 'app_private'
      and grantee in ('PUBLIC', 'anon', 'authenticated', 'service_role')
  ),
  0,
  'public and Data API roles have no private-function grants'
);

select ok(
  not has_schema_privilege('anon', 'api', 'usage')
    and not has_schema_privilege('authenticated', 'api', 'usage')
    and not has_schema_privilege('service_role', 'api', 'usage')
    and not has_schema_privilege('anon', 'app_private', 'usage')
    and not has_schema_privilege('authenticated', 'app_private', 'usage')
    and not has_schema_privilege('service_role', 'app_private', 'usage'),
  'Data API roles cannot use locked application schemas'
);

select is(
  (
    select array_agg(attribute.attname order by key_column.ordinality)::text
    from pg_constraint as constraint_row
    cross join lateral unnest(constraint_row.conkey) with ordinality as key_column(attnum, ordinality)
    join pg_attribute as attribute
      on attribute.attrelid = constraint_row.conrelid
     and attribute.attnum = key_column.attnum
    where constraint_row.conrelid = 'app_private.user_accounts'::regclass
      and constraint_row.contype = 'p'
  ),
  '{id}',
  'application account id is the user_accounts primary key'
);

select is(
  (
    select constraint_row.confdeltype::text
    from pg_constraint as constraint_row
    where constraint_row.conrelid = 'app_private.audit_events'::regclass
      and constraint_row.confrelid = 'app_private.user_accounts'::regclass
      and constraint_row.contype = 'f'
      and exists (
        select 1
        from unnest(constraint_row.conkey) as key_attnum
        join pg_attribute as attribute
          on attribute.attrelid = constraint_row.conrelid
         and attribute.attnum = key_attnum
        where attribute.attname = 'actor_account_id'
      )
  ),
  'n',
  'deleting an application account preserves audit events and nulls actor reference'
);

select is(
  (
    select attribute.atttypmod
    from pg_attribute as attribute
    where attribute.attrelid = 'app_private.policy_chunk_embeddings'::regclass
      and attribute.attname = 'embedding'
      and not attribute.attisdropped
  ),
  -1,
  'embedding storage supports versioned profiles with variable dimensions'
);

select ok(
  exists (
    select 1
    from pg_trigger as trigger_row
    where trigger_row.tgrelid = 'app_private.embedding_profiles'::regclass
      and trigger_row.tgname = 'embedding_profiles_protect_identity'
      and not trigger_row.tgisinternal
  ),
  'embedding profile identity has an immutability trigger'
);

select is(
  (select public::text from storage.buckets where id = 'policy-sources'),
  'false',
  'policy source bucket is private'
);

select is(
  (select public::text from storage.buckets where id = 'generated-exports'),
  'false',
  'generated export bucket is private'
);

select is(
  (
    select count(*)::integer
    from storage.buckets
    where (
      id = 'policy-sources'
      and file_size_limit = 52428800
      and cardinality(allowed_mime_types) = 2
      and allowed_mime_types @> array['application/pdf', 'text/plain']::text[]
    ) or (
      id = 'generated-exports'
      and file_size_limit = 52428800
      and cardinality(allowed_mime_types) = 3
      and allowed_mime_types @> array[
        'application/pdf',
        'application/zip',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ]::text[]
    )
  ),
  2,
  'private bucket size and MIME controls match the reviewed configuration'
);

select * from finish();
rollback;
