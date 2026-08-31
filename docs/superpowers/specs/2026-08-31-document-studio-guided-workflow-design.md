# Document Studio Guided Workflow Design

**Approved direction:** 2026-08-31

**Applies to:** `src/app/incidents/[incidentId]`, the Document Studio section
navigation, the incident-level next-action treatment, and related desktop/mobile
behavior.

## Goal

Make Document Studio immediately tell an authorized officer what incident they
are working on, what trustworthy action is available next, and where the four
meaningful work areas live. Preserve the existing review-first safety model,
source visibility, report attribution, append-only revision history, and honest
unavailable states.

## Design source

This is a targeted refinement inside the owner-approved Guided Operations design
system in `docs/product/experience-design-brief.md`. It keeps the existing cool
blue-gray canvas, deep navy structure, restrained gold accent, editorial serif
only for the primary incident title, system sans-serif for operational controls,
fine borders, 44 CSS-pixel targets, and low-motion interaction.

No new visual theme, stock imagery, decorative metrics, shield treatment, or
fabricated workflow progress is introduced. The approved concept is the complete
composition described below.

## First viewport composition

Desktop order:

1. Shared officer shell and workspace navigation.
2. A compact incident work header containing:
   - back link to Reports;
   - incident name as the page title;
   - incident number, category, current revision, and trustworthy incident
     status when available;
   - a bounded next-action block derived only from the authorized workspace and
     report summaries.
3. Four equal-width section controls: Reports, Notes & Facts, Paperwork,
   Incident Record.
4. The active work panel with no redundant outer dashboard card.

Conceptual desktop layout:

```text
Reports / Account / Policy Expert / Forms / Count Sheet

← Back to Reports
Fictional Report Workspace Qualification
F-WORKSPACE-001 · Training · Revision 1 · In review

NEXT ACTION
Review the available facts and request the first officer report.
[Open Reports]

Reports      Notes & Facts      Paperwork      Incident Record
----------------------------------------------------------------
Active work surface
```

Mobile order remains the same. The four sections become a labeled native select
control at narrow widths so the current location is visible without horizontal
scrolling. The incident title, revision, next-action text, and action remain
readable at 320 CSS pixels and 200% text size.

## Information architecture

The former six destinations are consolidated into four:

### Reports

Contains:

- linked report rows and their truthful status, current revision, and updated
  time;
- the existing report-draft request workflow;
- a clearly separated Copy to Records subsection.

Copy to Records remains unavailable until its product and records workflow is
approved. It is not a top-level destination while unavailable. Its message
remains explicit that no fake print or Word actions are provided.

### Notes & Facts

Contains only reviewed fact states from the current authorized incident
revision. Confirmed version-two facts with no reporting-officer attribution
remain hidden. Unknown and not-applicable facts keep their reason visible. Raw
field notes remain server-side.

### Paperwork

Contains the approved required-paperwork catalog. Items are grouped by
capability:

- Available through Officer Reports;
- Physical form required;
- Digital support not yet available.

The grouping changes visual hierarchy only. It does not convert a physical-only
item into a digital workflow and does not claim incomplete source-form mappings
are available.

### Incident Record

Combines the current incident overview and report-history summary:

- incident number and name;
- category;
- current incident revision;
- trustworthy incident status and timestamps when available;
- reporting-officer count;
- visible confirmed-fact count;
- linked-report count;
- current report revision heads and links to each report history;
- honest explanation that a complete incident revision browser is not yet
  exposed.

## Next-action model

The next action is advisory navigation, not a persisted workflow state and not a
completion percentage. It is derived with a pure function from already
authorized data.

```ts
export type IncidentNextAction = Readonly<{
  destination: "reports" | "notes-facts" | "paperwork" | "incident-record";
  label: string;
  summary: string;
}>;
```

Priority order:

1. If there are no reporting officers, direct the user to Incident Record
   because a report cannot be attributed safely.
2. If there are visible unresolved facts (`unknown` or `not_applicable`), direct
   the user to Notes & Facts and name the count without calling those facts
   complete or incomplete.
3. If there are no visible confirmed facts, direct the user to Notes & Facts and
   state that no confirmed facts are available for a report.
4. If there are no linked reports, direct the user to Reports and invite the
   officer to review available facts and request the first report.
5. If any linked report is in draft or review state, direct the user to Reports
   and invite review of the existing report work.
6. Otherwise direct the user to Reports to open the completed report history or
   start another supported report.

The function must not infer packet completeness, missing required paperwork,
submission, filing, synchronization, or system-of-record status.

## Interaction model

- Desktop uses an ARIA tab list with arrow-key, Home, and End navigation.
- Mobile uses a labeled native select bound to the same active-section state.
  The tab list is visually hidden at the mobile breakpoint rather than
  horizontally scrolled.
- The next-action button activates the destination section in-place and moves
  focus to the section heading.
- All four section controls reference the one rendered tab panel.
- Focus indication remains stronger than hover.
- Motion is limited to brief background, border, or arrow transitions and is
  removed under `prefers-reduced-motion`.

## Component boundaries

The feature is split only where responsibilities are distinct:

```text
src/features/incidents/document-studio-catalog.ts
  Four-section labels, descriptions, and paperwork capability catalog.

src/features/incidents/derive-incident-next-action.ts
  Pure deterministic advisory action derivation.

src/features/incidents/incident-work-header.tsx
  Incident identity, trustworthy metadata, and next-action presentation.

src/features/incidents/document-studio.tsx
  Section state, accessible desktop/mobile navigation, and panel composition.
```

Existing server services and database contracts remain unchanged. The incident
page passes already authorized `incident`, `reports`, and `workspace` values to
the header and studio.

## Visual system

### Operational container model

- Use open document-oriented surfaces rather than another large rounded
  dashboard wrapper.
- The section navigation sits on one fine divider.
- The active panel uses a white surface with a fine border and a small radius;
  it has no large floating shadow.
- Tables remain tables. Facts and paperwork remain readable lists rather than a
  bento grid.

### Typography

- Incident title: existing editorial serif.
- Next-action heading, section controls, form labels, status, tables, and
  instructions: system sans-serif.
- Section headings: system sans-serif with strong navy weight, not oversized
  editorial display type.

### Color

- Canvas and surface colors remain the existing cool blue-gray and white tokens.
- Navy carries primary structure and action.
- Gold is limited to the small Next action orientation line or current-section
  marker.
- Unavailable and physical-only states use semantic text and borders, not
  decorative warning fields.

## Responsive requirements

- No horizontal page scrolling at 320, 390, 768, or desktop widths.
- Native mobile section selection has a minimum 44-pixel height.
- The next-action control remains reachable without obscuring the title.
- Status text wraps with its record.
- Tables may use their existing bounded internal overflow when columns cannot
  collapse safely.
- At 200% text size and 400% zoom, section selection remains visible and focus
  rings are not clipped.

## Safety and truthful-state requirements

- Every displayed incident, report, revision, officer, fact, timestamp, status,
  and count comes from the current authorized server result.
- No operational sample rows are added.
- No client fallback invents work when a read fails.
- Copy to Records remains explicitly unavailable.
- Physical-only paperwork remains physical-only.
- The next action is omitted only when the data required to derive it is
  unavailable; it never fabricates a substitute state.
- This change does not deploy, migrate data, alter authorization, create
  identities, or change official-output fidelity gates.

## Error, empty, and unavailable behavior

- Missing incident summary: retain the existing bounded unavailable message
  inside Incident Record; do not hide the rest of the authorized workspace.
- No reports: Reports shows the existing empty state and the supported draft
  request form.
- No reviewed facts: Notes & Facts states that none are stored on the current
  revision.
- No paperwork catalog match: Paperwork states that no approved catalog matches
  the category.
- Unavailable Copy to Records: show the approved explanatory message inside
  Reports.

## Acceptance criteria

- Exactly four top-level Document Studio sections are exposed.
- Reports is the initial section because it contains the primary supported
  output workflow.
- The next action is deterministic, truthful, tested, and activates one of the
  four sections.
- Copy to Records is subordinate to Reports.
- Overview and history appear together in Incident Record.
- Desktop keyboard tab behavior remains complete.
- Mobile does not use a horizontally scrolling section rail.
- The active panel is visually quieter than Officer Home.
- Existing report drafting, fact scoping, paperwork capability labels, and
  report-history links remain functional.
- Unit tests cover every next-action priority branch and the new four-section
  navigation.
- Authenticated browser coverage opens Reports by default, exercises Notes &
  Facts, and confirms 390-pixel no-overflow behavior.
- Formatting, linting, TypeScript, unit/operations tests, and the optimized
  production build pass before handoff.
