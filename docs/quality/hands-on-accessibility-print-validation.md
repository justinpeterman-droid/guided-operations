# Hands-on accessibility and print validation

Use this runbook to close the manual follow-on item in the
[UI Polish Implementation Checklist](../product/ui-polish-implementation-checklist.md).
It records human observations; it does not turn automated browser evidence into
a claim about native screen-reader speech or the operating-system print dialog.

## When to use it

Run this against the exact release-candidate commit in the browser and
operating-system combination intended for the pilot. Use only a controlled,
non-production environment and fictional accounts and records. Do not enter,
copy, print, or attach real operational information.

Automated coverage already verifies the application signals that it is opening
the print dialog only after the required application audit succeeds. This
runbook verifies the two operating-system-level experiences that automation
cannot observe:

- a representative assistive-technology user hears the important live status
  messages; and
- the browser actually presents the system print dialog with the expected
  content and controls.

## Record before testing

Create one evidence record containing:

- commit SHA and environment URL;
- test date, reviewer role or initials, browser name/version, and operating
  system/version;
- assistive technology and version, plus its relevant settings; and
- the fictional account and fictional record identifiers used.

Do not record passcodes, session data, or any personal or operational data.

## Screen-reader validation

Use the screen reader normally supported on the target operating system. A
representative assistive-technology user should complete these checks with the
keyboard, noting what was announced and whether the sequence was understandable
without relying on color or visual placement.

1. Open the protected Count Sheet and confirm the page heading, table entry
   fields, column and row context, reconciliation state, and print control have
   useful accessible names.
2. With the fictional sheet incomplete, confirm the incomplete reconciliation
   status is announced once and does not falsely sound reconciled.
3. Enter documented fictional values that make the sheet reconciled, then
   introduce a documented positive or negative difference. Confirm each status
   change is announced clearly and the signed difference is understandable.
4. In Document Studio, navigate each of the four sections (Reports, Notes &
   Facts, Paperwork, and Incident Record). Confirm the selected section and any
   loading, unavailable, or error status encountered are understandable.
5. Trigger a controlled save, conflict-recovery, or unavailable state only when
   it is available in the fictional test fixture. Confirm the typed correction
   remains available after a conflict and that no fabricated success is
   announced.

Record the exact route, control, expected result, observed announcement, and
result for every check: **Pass**, **Issue**, or **Not exercised**. "Not
exercised" is not a pass.

## Operating-system print-dialog validation

Perform the following for a saved fictional Count Sheet and, when available, a
fictional report revision:

1. Start from a saved, reviewable record and select the applicable print action.
2. Confirm the application reports that the print request was recorded before
   the browser invokes printing.
3. Confirm the operating-system print dialog or browser print preview actually
   opens. Inspect its title, selected printer/destination controls, page range,
   orientation, and cancel action using the keyboard and assistive technology
   where applicable.
4. Review the preview using the supported Letter and A4 options where available.
   Check for clipped text, overlapping content, blank trailing pages, and
   accidentally printed navigation, buttons, debug content, or backgrounds.
5. Cancel the dialog unless an owner-approved fictional print destination is
   available. Do not send a physical copy containing anything other than the
   approved fictional fixture.

Record the route, record revision, dialog/preview that appeared, each observed
result, and any limitation. A failure to open the native dialog after the
application reports success is an issue; do not mark it as passed based solely
on automated `window.print` stubbing.

## Closeout and escalation

Link the completed evidence record from the UI-polish checklist and record the
exact tested commit. File each issue with reproduction steps, environment,
assistive-technology/browser/operating-system versions, expected result,
observed result, and any safe screenshot or recording approved for retention.

Before a pilot, resolve each issue or obtain explicit owner acceptance of its
risk and release impact. This manual check complements, but does not replace,
the broader [testing strategy](testing-strategy.md) and
[definition of done](definition-of-done.md).
