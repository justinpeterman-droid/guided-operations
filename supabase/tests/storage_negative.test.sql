begin;

select plan(9);

insert into storage.objects (bucket_id, name, metadata)
values
  ('policy-sources', 'fictional/qualification-policy.pdf', '{}'::jsonb),
  ('generated-exports', 'fictional/qualification-export.pdf', '{}'::jsonb);

set local role anon;

select is(
  (select count(*)::integer from storage.objects
   where bucket_id in ('policy-sources', 'generated-exports')),
  0,
  'anonymous requests cannot list private bucket objects'
);

select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('policy-sources', 'fictional/anonymous-policy.pdf') $$,
  '42501',
  'new row violates row-level security policy for table "objects"',
  'anonymous requests cannot write policy sources'
);

select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('generated-exports', 'fictional/anonymous-export.pdf') $$,
  '42501',
  'new row violates row-level security policy for table "objects"',
  'anonymous requests cannot write generated exports'
);

reset role;
set local role authenticated;

select is(
  (select count(*)::integer from storage.objects
   where bucket_id in ('policy-sources', 'generated-exports')),
  0,
  'authenticated browser requests cannot list private bucket objects'
);

select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('policy-sources', 'fictional/authenticated-policy.pdf') $$,
  '42501',
  'new row violates row-level security policy for table "objects"',
  'authenticated browser requests cannot write policy sources'
);

select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('generated-exports', 'fictional/authenticated-export.pdf') $$,
  '42501',
  'new row violates row-level security policy for table "objects"',
  'authenticated browser requests cannot write generated exports'
);

select results_eq(
  $$ update storage.objects set name = 'fictional/changed.pdf'
     where bucket_id = 'policy-sources'
     returning id $$,
  array[]::uuid[],
  'authenticated browser requests cannot alter private objects'
);

select throws_ok(
  $$ delete from storage.objects
     where bucket_id = 'generated-exports'
     returning id $$,
  '42501',
  'Direct deletion from storage tables is not allowed. Use the Storage API instead.',
  'authenticated browser requests cannot delete private objects'
);

reset role;

select is(
  (select count(*)::integer from storage.objects
   where name in (
     'fictional/qualification-policy.pdf',
     'fictional/qualification-export.pdf'
   )),
  2,
  'the denied browser operations leave both private objects unchanged'
);

select * from finish();
rollback;
