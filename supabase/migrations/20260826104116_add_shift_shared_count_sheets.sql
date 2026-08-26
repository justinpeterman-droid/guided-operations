begin;

alter table app_private.staff_members
  add column shift_code text;

alter table app_private.staff_members
  add constraint staff_members_shift_code_check
  check (shift_code is null or shift_code in ('A', 'B', 'C', 'D', 'U', 'F'));

create index staff_members_facility_shift_status_idx
  on app_private.staff_members (facility_id, shift_code, status)
  where shift_code is not null;

comment on column app_private.staff_members.shift_code is
  'Administrator-assigned Count Sheet shift code: A/B day shift, C/D night shift, U five-day week, F five-day-week field. Null means no assigned shift and grants no Count Sheet access.';

commit;
