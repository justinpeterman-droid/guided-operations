begin;

do $$
begin
  if exists (
    select 1
      from app_private.reports
      where report_type not in (
        'first_person',
        'supervisor_summary',
        'cover_letter',
        'disciplinary'
      )
  ) or exists (
    select 1
      from app_private.report_draft_candidates
      where report_type not in (
        'first_person',
        'supervisor_summary',
        'cover_letter',
        'disciplinary'
      )
  ) then
    raise exception using
      errcode = '23514',
      message = 'Unsupported report types must be reconciled before this migration can apply';
  end if;
end;
$$;

alter table app_private.reports
  add constraint reports_report_type_controlled_check
  check (
    report_type in (
      'first_person',
      'supervisor_summary',
      'cover_letter',
      'disciplinary'
    )
  );

alter table app_private.report_draft_candidates
  add constraint report_draft_candidates_report_type_controlled_check
  check (
    report_type in (
      'first_person',
      'supervisor_summary',
      'cover_letter',
      'disciplinary'
    )
  );

comment on constraint reports_report_type_controlled_check
  on app_private.reports is
  'Restricts persisted reports to the approved legacy report package.';

comment on constraint report_draft_candidates_report_type_controlled_check
  on app_private.report_draft_candidates is
  'Restricts review-only candidates to the approved legacy report package.';

commit;
