# Official 005/409 source-form review

- **Date:** 2026-08-30
- **Status:** source-form fidelity gate open
- **Purpose:** distinguish approved deterministic mapping from authoritative source-form fidelity

## Evidence reviewed

1. Google Drive file `Incident-Accident Package Checklist.pdf` confirms that an `005/409 Form` is a required incident-package component for multiple incident types.
2. Google Drive file `005 templet.docx` was reviewed as text and rendered as a 27-page document. It is a collection of incident/report narrative examples and operational notes, not the official 005/409 form layout.
3. Current repository mapping code intentionally contains only the previously approved deterministic values: 005/409 designation, approximate time, presence text, and location.

## Decision

`005 templet.docx` must **not** be treated as the authoritative source form and must not be copied into the application as an official template.

The application may call an output `official 005/409` only when all of the following are recorded for the exact source revision:

- authoritative source kind is confirmed;
- revision/version identifier is recorded;
- SHA-256 of the source bytes is recorded;
- field-to-domain mapping is reviewed and approved;
- generated output is visually compared to the source and fidelity is approved.

Until then the current deterministic mapper is an approved mapping component, not a completed official-form renderer.

## Next evidence needed

Obtain the actual current 005/409 source form (DOCX, fillable PDF, or scanned authoritative blank) from the approved custody/source channel. Record its revision/date and hash before implementation. Then inventory every visible field, checkbox, label, page region, signature/initial area, and formatting requirement before adding rendering code.
