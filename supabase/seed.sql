-- Local development data must remain obviously fictional.
-- Production and preview projects must never run this seed automatically.

insert into app_private.facilities (
  singleton_key,
  slug,
  display_name,
  region_code
)
values (
  1,
  'fictional-training-facility',
  'Fictional Training Facility',
  'us-test-1'
)
on conflict (singleton_key) do nothing;
