begin;

-- Security remediation item 1 (docs/quality/2026-09-01-security-remediation-plan-review.md,
-- "Recommended order" #1): api.list_daily_paperwork_status(date, text) and
-- api.get_daily_paperwork_template(uuid, date) were superseded by their
-- session-authority-bound _v2 forms in 20260827132000. Their execute grants
-- were already revoked from every client role in that migration, but the
-- functions themselves still existed, were still called internally by the
-- _v2 wrappers, and still carried the weak (non-auth_version-checked)
-- authorization logic. No caller in src/ ever names the v1 functions
-- directly (confirmed: only the generated Supabase type file references
-- them, and only the _v2 names appear in src/server/paperwork).
--
-- This migration inlines the v1 query logic directly into the _v2 wrappers
-- -- reusing the facility id the _v2 functions already resolve through the
-- strong app_private.current_daily_paperwork_admin_facility_id() anchor
-- instead of re-deriving it with the weaker, auth_version-blind query the v1
-- functions used -- and then drops the v1 functions outright. This is a
-- behavior-preserving refactor for every existing caller: the _v2 functions
-- keep their exact signatures, return shapes, and grants (CREATE OR REPLACE
-- preserves existing ACLs), and the ordering of authorization-before-input-
-- validation is unchanged from what a caller observes today.

create or replace function api.list_daily_paperwork_status_v2(
  p_work_date date,
  p_shift_code text
)
returns table (
  template_code text,
  display_title text,
  configured boolean,
  template_id uuid,
  template_version integer,
  print_orientation text,
  capabilities text[],
  record_id uuid,
  current_revision_number integer,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_facility_id uuid;
begin
  actor_facility_id := app_private.current_daily_paperwork_admin_facility_id();
  if actor_facility_id is null then
    return;
  end if;

  if p_work_date is null
    or p_shift_code not in ('A', 'B', 'C', 'D', 'U', 'F') then
    raise exception using errcode = '22023', message = 'Invalid Daily Paperwork date or shift';
  end if;

  return query
    with catalog(template_code, display_title, sort_order) as (
      values
        ('assignment_roster'::text, 'Shift Assignment Roster'::text, 1),
        ('uniform_inspection', 'Uniform Inspection Log', 2),
        ('metal_detector_test', 'Walk-Through Metal Detector Test', 3),
        ('perimeter_check', 'Perimeter Check List', 4),
        ('random_search_log', 'Random Searches Log', 5),
        ('detector_sign_out', 'Handheld Metal Detector Sign-Out', 6)
    )
    select
      catalog.template_code,
      catalog.display_title,
      template.id is not null,
      template.id,
      template.version,
      template.print_orientation,
      coalesce(template.capabilities, '{}'::text[]),
      record.id,
      record.current_revision_number,
      record.updated_at
    from catalog
    left join lateral (
      select candidate.*
      from app_private.form_templates as candidate
      where candidate.facility_id = actor_facility_id
        and candidate.template_code = catalog.template_code
        and candidate.active_from <= p_work_date
      order by candidate.version desc, candidate.id desc
      limit 1
    ) as template on
      template.rights_status = 'approved_internal_use'
      and (
        template.active_until is null
        or template.active_until >= p_work_date
      )
    left join app_private.paperwork_records as record
      on record.facility_id = actor_facility_id
      and record.kind = catalog.template_code
      and record.work_date = p_work_date
      and record.shift_code = p_shift_code
      and record.archived_at is null
    order by catalog.sort_order;
end;
$$;

comment on function api.list_daily_paperwork_status_v2(date, text) is
  'Session-version-bound administrator Daily Paperwork catalog. It returns no form body.';

create or replace function api.get_daily_paperwork_template_v2(
  p_template_id uuid,
  p_work_date date
)
returns table (
  template_id uuid,
  template_code text,
  title text,
  version integer,
  source_revision text,
  source_sha256 text,
  print_orientation text,
  capabilities text[],
  structure jsonb,
  field_schema jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_facility_id uuid;
begin
  actor_facility_id := app_private.current_daily_paperwork_admin_facility_id();
  if actor_facility_id is null then
    return;
  end if;

  if p_template_id is null or p_work_date is null then
    raise exception using errcode = '22023', message = 'Invalid Daily Paperwork template reference';
  end if;

  return query
    select
      template.id,
      template.template_code,
      template.title,
      template.version,
      template.source_revision,
      template.source_sha256,
      template.print_orientation,
      template.capabilities,
      template.structure,
      template.field_schema
    from app_private.form_templates as template
    where template.id = p_template_id
      and template.facility_id = actor_facility_id
      and template.rights_status = 'approved_internal_use'
      and template.active_from <= p_work_date
      and (
        template.active_until is null
        or template.active_until >= p_work_date
      )
      and not exists (
        select 1
        from app_private.form_templates as successor
        where successor.facility_id = template.facility_id
          and successor.template_code = template.template_code
          and successor.version > template.version
          and successor.active_from <= p_work_date
      );
end;
$$;

comment on function api.get_daily_paperwork_template_v2(uuid, date) is
  'Session-version-bound reader for one approved private Daily Paperwork template.';

-- Both v1 functions have carried zero execute grants (public, anon,
-- authenticated, and service_role were all revoked as of 20260827132000) and
-- have no caller left now that the _v2 wrappers no longer invoke them by
-- name. Drop them outright rather than leave unreachable dead surface with
-- weak, non-auth_version-checked authorization logic sitting in the
-- catalog.
drop function api.list_daily_paperwork_status(date, text);
drop function api.get_daily_paperwork_template(uuid, date);

commit;
