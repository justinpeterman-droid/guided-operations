# Document Studio Guided Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the equal-weight six-tab Document Studio with a truthful four-section, next-action-guided workspace that is quieter on desktop and clearer on mobile.

**Architecture:** Keep the existing Next.js App Router page and server reads unchanged. Add one pure next-action derivation module, one client-presentational incident header, and consolidate the existing panels inside the current client Document Studio boundary. Use the existing global design tokens and ARIA tab behavior; add a native mobile section select bound to the same state.

**Tech Stack:** Next.js 16.3.2 App Router, React 19.2.8, TypeScript 5.9.3, Vitest 4.1.11, Testing Library, Playwright 1.62.1, global CSS.

**Spec:** `docs/superpowers/specs/2026-08-31-document-studio-guided-workflow-design.md`

## Global Constraints

- Preserve the owner-approved cool blue-gray, navy, restrained-gold design system in `docs/product/experience-design-brief.md`.
- Use React Server Components by default and keep `"use client"` at the existing Document Studio interactive boundary.
- Display only authorized incident, report, revision, fact, officer, timestamp, status, and count values.
- Never infer packet completeness, filing, submission, synchronization, or system-of-record state.
- Keep Copy to Records explicitly unavailable and subordinate to Reports.
- Keep physical-only paperwork physical-only.
- Preserve 44 CSS-pixel targets, keyboard tab behavior, focus visibility, reduced motion, 320-pixel width support, and 200% text support.
- Do not change server services, database schema, authorization, migrations, provider configuration, or deployment traffic.

---

### Task 1: Define the four-section catalog and deterministic next action

**Files:**
- Modify: `src/features/incidents/document-studio-catalog.ts`
- Create: `src/features/incidents/derive-incident-next-action.ts`
- Create: `src/features/incidents/derive-incident-next-action.test.ts`

**Interfaces:**
- Produces: `DocumentStudioTabId = "reports" | "notes-facts" | "paperwork" | "incident-record"`.
- Produces: `deriveIncidentNextAction(input): IncidentNextAction`.
- Consumes: `StoredReviewedFact` and `ReportSummary` read-only values already authorized by server services.

- [ ] **Step 1: Write failing catalog and derivation tests**

Create `derive-incident-next-action.test.ts` with table-driven cases for all priority branches:

```ts
import { describe, expect, it } from "vitest";

import { DOCUMENT_STUDIO_TABS } from "./document-studio-catalog";
import { deriveIncidentNextAction } from "./derive-incident-next-action";

const confirmedFact = {
  id: "33333333-3333-4333-8333-333333333333",
  field: "Location",
  state: "confirmed" as const,
  value: "Fictional housing area",
  sourceNoteIds: ["44444444-4444-4444-8444-444444444444"],
  reportingStaffMemberIds: ["55555555-5555-4555-8555-555555555555"],
};

const completedReport = {
  reportId: "66666666-6666-4666-8666-666666666666",
  incidentNumber: "F-001",
  incidentName: "Fictional incident",
  reportType: "first_person" as const,
  status: "complete" as const,
  currentRevisionNumber: 1,
  updatedAt: "2026-08-31T12:00:00.000Z",
};

describe("Document Studio guidance", () => {
  it("exposes exactly the four approved sections in task order", () => {
    expect(DOCUMENT_STUDIO_TABS.map((tab) => tab.id)).toEqual([
      "reports",
      "notes-facts",
      "paperwork",
      "incident-record",
    ]);
  });

  it.each([
    {
      name: "missing reporting officer",
      input: { reviewedFacts: [confirmedFact], reportingOfficerCount: 0, reports: [] },
      destination: "incident-record",
    },
    {
      name: "reviewed exception state",
      input: {
        reviewedFacts: [
          confirmedFact,
          {
            id: "77777777-7777-4777-8777-777777777777",
            field: "Time",
            state: "unknown" as const,
            reason: "Not established in the source notes.",
            sourceNoteIds: ["44444444-4444-4444-8444-444444444444"],
          },
        ],
        reportingOfficerCount: 1,
        reports: [],
      },
      destination: "notes-facts",
    },
    {
      name: "no confirmed facts",
      input: { reviewedFacts: [], reportingOfficerCount: 1, reports: [] },
      destination: "notes-facts",
    },
    {
      name: "first report",
      input: { reviewedFacts: [confirmedFact], reportingOfficerCount: 1, reports: [] },
      destination: "reports",
    },
    {
      name: "draft report",
      input: {
        reviewedFacts: [confirmedFact],
        reportingOfficerCount: 1,
        reports: [{ ...completedReport, status: "draft" as const }],
      },
      destination: "reports",
    },
    {
      name: "completed report history",
      input: {
        reviewedFacts: [confirmedFact],
        reportingOfficerCount: 1,
        reports: [completedReport],
      },
      destination: "reports",
    },
  ])("routes $name without inventing progress", ({ input, destination }) => {
    expect(deriveIncidentNextAction(input).destination).toBe(destination);
  });
});
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run:

```bash
npx vitest run src/features/incidents/derive-incident-next-action.test.ts
```

Expected: FAIL because the new module does not exist and the catalog still exposes six section ids.

- [ ] **Step 3: Implement the four-section catalog**

Replace only the section id and `DOCUMENT_STUDIO_TABS` definitions at the top of `document-studio-catalog.ts`:

```ts
export type DocumentStudioTabId =
  | "reports"
  | "notes-facts"
  | "paperwork"
  | "incident-record";

export const DOCUMENT_STUDIO_TABS = [
  {
    id: "reports",
    label: "Reports",
    description: "Draft, review, and report history",
  },
  {
    id: "notes-facts",
    label: "Notes & Facts",
    description: "Reviewed facts from this revision",
  },
  {
    id: "paperwork",
    label: "Paperwork",
    description: "Digital, physical, and unavailable forms",
  },
  {
    id: "incident-record",
    label: "Incident Record",
    description: "Incident details and revision heads",
  },
] as const satisfies ReadonlyArray<{
  id: DocumentStudioTabId;
  label: string;
  description: string;
}>;
```

Keep the existing paperwork catalog unchanged.

- [ ] **Step 4: Implement the pure derivation module**

Create `derive-incident-next-action.ts`:

```ts
import type { StoredReviewedFact } from "@/features/incidents/schema";
import type { ReportSummary } from "@/server/incidents/list-reports";

import type { DocumentStudioTabId } from "./document-studio-catalog";

export type IncidentNextAction = Readonly<{
  destination: DocumentStudioTabId;
  label: string;
  summary: string;
}>;

export type IncidentNextActionInput = Readonly<{
  reviewedFacts: readonly StoredReviewedFact[];
  reportingOfficerCount: number;
  reports: readonly ReportSummary[];
}>;

function isVisibleConfirmedFact(fact: StoredReviewedFact): boolean {
  if (fact.state !== "confirmed") return false;
  if (!("reportingStaffMemberIds" in fact)) return true;
  return fact.reportingStaffMemberIds.length > 0;
}

export function deriveIncidentNextAction(
  input: IncidentNextActionInput,
): IncidentNextAction {
  if (input.reportingOfficerCount === 0) {
    return {
      destination: "incident-record",
      label: "Review incident record",
      summary:
        "No reporting officer is assigned on this revision, so report work cannot be attributed yet.",
    };
  }

  const reviewedExceptionCount = input.reviewedFacts.filter(
    (fact) => fact.state === "unknown" || fact.state === "not_applicable",
  ).length;
  if (reviewedExceptionCount > 0) {
    return {
      destination: "notes-facts",
      label: "Review fact states",
      summary: `${reviewedExceptionCount} reviewed fact ${
        reviewedExceptionCount === 1 ? "state needs" : "states need"
      } attention before another report is requested.`,
    };
  }

  if (!input.reviewedFacts.some(isVisibleConfirmedFact)) {
    return {
      destination: "notes-facts",
      label: "Open Notes & Facts",
      summary: "No confirmed facts are available for an officer report.",
    };
  }

  if (input.reports.length === 0) {
    return {
      destination: "reports",
      label: "Open Reports",
      summary:
        "Review the available facts and request the first officer report.",
    };
  }

  if (
    input.reports.some(
      (report) => report.status === "draft" || report.status === "in_review",
    )
  ) {
    return {
      destination: "reports",
      label: "Review report work",
      summary:
        "Open the existing draft or report under review before starting another output.",
    };
  }

  return {
    destination: "reports",
    label: "Open report history",
    summary:
      "Open completed report history or start another supported officer report.",
  };
}
```

- [ ] **Step 5: Run the focused test and confirm GREEN**

Run:

```bash
npx vitest run src/features/incidents/derive-incident-next-action.test.ts
```

Expected: PASS with all catalog and priority cases green.

- [ ] **Step 6: Commit the task**

```bash
git add src/features/incidents/document-studio-catalog.ts \
  src/features/incidents/derive-incident-next-action.ts \
  src/features/incidents/derive-incident-next-action.test.ts
git commit -m "feat: derive truthful Document Studio guidance"
```

### Task 2: Add the incident work header and activate its destination

**Files:**
- Create: `src/features/incidents/incident-work-header.tsx`
- Modify: `src/features/incidents/document-studio.tsx`
- Modify: `src/features/incidents/document-studio.test.tsx`
- Modify: `src/app/incidents/[incidentId]/page.tsx`

**Interfaces:**
- Consumes: `IncidentNextAction`, `IncidentSummary | null`, and `IncidentReportWorkspace`.
- Produces: `IncidentWorkHeader` with `onActivateSection(sectionId)`.
- Document Studio owns active-section state so the header action and navigation never diverge.

- [ ] **Step 1: Rewrite the component test for the approved first viewport**

Update the first Document Studio test so it expects Reports selected by default, the incident header, exactly four sections, and a working next-action control:

```ts
it("starts in Reports and keeps truthful incident guidance attached", async () => {
  const user = userEvent.setup();
  const view = render(
    <DocumentStudio incident={incident} reports={[]} workspace={workspace} />,
  );
  const root = within(view.container);

  expect(
    root.getByRole("heading", { name: workspace.displayName }),
  ).toBeVisible();
  expect(root.getByText(workspace.incidentNumber)).toBeVisible();
  expect(root.getByText(/Revision 1/)).toBeVisible();
  expect(root.getByRole("tab", { name: /^Reports/i })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  expect(root.getAllByRole("tab")).toHaveLength(4);
  expect(root.getByText(/request the first officer report/i)).toBeVisible();

  await user.click(root.getByRole("button", { name: "Open Reports" }));
  expect(root.getByRole("heading", { name: "Reports" })).toHaveFocus();
});
```

- [ ] **Step 2: Run the focused component test and confirm RED**

Run:

```bash
npx vitest run src/features/incidents/document-studio.test.tsx
```

Expected: FAIL because the page header is still outside Document Studio, Overview is selected, and six tabs remain.

- [ ] **Step 3: Create `IncidentWorkHeader`**

Implement a client-presentational component with:

- a `Back to reports` link;
- the incident name as `h1`;
- incident number, category, revision, and optional status as a wrapping metadata list;
- a `Next action` section containing summary and a button;
- the button calling `onActivateSection(nextAction.destination)`.

Use no local data fallback and no stored state.

- [ ] **Step 4: Move incident identity into Document Studio**

In `document-studio.tsx`:

- start `activeTab` at `"reports"`;
- derive the next action from `workspace.reviewedFacts`, `workspace.reportingOfficers.length`, and `reports`;
- render `IncidentWorkHeader` before the section navigation;
- add a `sectionHeadingId` map;
- on header activation, set active section and focus the active panel heading with `tabIndex={-1}` after React commits the panel.

In `src/app/incidents/[incidentId]/page.tsx`, remove the old `reports-intro` section and render only the `DocumentStudio` inside `WorkspaceShell`.

- [ ] **Step 5: Run the component test and confirm GREEN**

Run:

```bash
npx vitest run src/features/incidents/document-studio.test.tsx
```

Expected: PASS for default section, header identity, four-section count, and next-action focus.

- [ ] **Step 6: Commit the task**

```bash
git add src/features/incidents/incident-work-header.tsx \
  src/features/incidents/document-studio.tsx \
  src/features/incidents/document-studio.test.tsx \
  'src/app/incidents/[incidentId]/page.tsx'
git commit -m "feat: guide officers from the incident header"
```

### Task 3: Consolidate the panels without losing supported work

**Files:**
- Modify: `src/features/incidents/document-studio.tsx`
- Modify: `src/features/incidents/document-studio.test.tsx`

**Interfaces:**
- Reports panel owns linked reports, draft request, and unavailable Copy to Records.
- Paperwork panel groups existing catalog entries by capability.
- Incident Record owns overview values and report revision heads.

- [ ] **Step 1: Add failing consolidation tests**

Add tests that:

- assert no top-level `Copy to Records`, `Overview`, or `History` tab exists;
- open Reports and find both the draft request placeholder and Copy to Records unavailable message;
- open Incident Record and find incident number plus `Current incident revision` and report revision-head content;
- open Paperwork and find the approved capability group headings;
- preserve the unattributed confirmed-fact exclusion in Notes & Facts.

- [ ] **Step 2: Run the focused component test and confirm RED**

Run:

```bash
npx vitest run src/features/incidents/document-studio.test.tsx
```

Expected: FAIL until the old panel routing is consolidated.

- [ ] **Step 3: Consolidate Reports**

Rename `OfficerReportsPanel` to `ReportsPanel`. Keep the linked-report table and `ReportDraftRequestForm`. Append a nested section:

```tsx
<section
  className="document-studio-subsection"
  aria-labelledby="studio-copy-title"
>
  <h3 id="studio-copy-title">Copy to Records</h3>
  <p>Copy-only records text stays separate from printable officer reports.</p>
  <p className="document-studio-empty" role="status">
    Copy-to-records output is not yet available in this workspace. Use Reports
    for supported draft, review, and finalize work until the copy-only path is
    approved and tested.
  </p>
</section>
```

Delete the old top-level CopyToRecords panel.

- [ ] **Step 4: Group Paperwork by capability**

Map required form keys through `describeDocumentStudioForm`, group by `available_in_reports`, `physical_only`, and `not_yet_available`, and render only non-empty groups under these exact headings:

- `Available through Officer Reports`
- `Physical form required`
- `Digital support not yet available`

Keep every item label and detail unchanged.

- [ ] **Step 5: Merge overview and history into Incident Record**

Replace `OverviewPanel` and `HistoryPanel` with `IncidentRecordPanel`. Preserve the overview definition list, the current incident revision card, report revision-head table, missing-incident-summary state, and no-history empty state.

- [ ] **Step 6: Update the section switch**

Render only:

```tsx
{activeTab === "reports" ? <ReportsPanel {...props} /> : null}
{activeTab === "notes-facts" ? <NotesAndFactsPanel {...props} /> : null}
{activeTab === "paperwork" ? <PaperworkPanel {...props} /> : null}
{activeTab === "incident-record" ? <IncidentRecordPanel {...props} /> : null}
```

- [ ] **Step 7: Run focused tests and confirm GREEN**

Run:

```bash
npx vitest run \
  src/features/incidents/derive-incident-next-action.test.ts \
  src/features/incidents/document-studio.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Commit the task**

```bash
git add src/features/incidents/document-studio.tsx \
  src/features/incidents/document-studio.test.tsx
git commit -m "refactor: consolidate Document Studio work areas"
```

### Task 4: Implement the quieter desktop surface and mobile section selector

**Files:**
- Modify: `src/features/incidents/document-studio.tsx`
- Modify: `src/features/incidents/document-studio.test.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Desktop retains the ARIA tab list.
- Mobile exposes `select[aria-label="Document Studio section"]` bound to the same `activeTab`.

- [ ] **Step 1: Add a failing mobile-control test**

```ts
it("keeps a native mobile section control synchronized with desktop tabs", async () => {
  const user = userEvent.setup();
  const view = render(
    <DocumentStudio incident={incident} reports={[]} workspace={workspace} />,
  );
  const root = within(view.container);
  const select = root.getByRole("combobox", {
    name: "Document Studio section",
  });

  expect(select).toHaveValue("reports");
  await user.selectOptions(select, "notes-facts");
  expect(root.getByRole("tab", { name: /Notes & Facts/i })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  expect(root.getByText("8 Barracks")).toBeVisible();
});
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run:

```bash
npx vitest run src/features/incidents/document-studio.test.tsx
```

Expected: FAIL because the native selector does not exist.

- [ ] **Step 3: Add synchronized mobile selection**

Before the desktop tab list, render:

```tsx
<label className="document-studio-mobile-select">
  <span>Section</span>
  <select
    aria-label="Document Studio section"
    onChange={(event) => activateTab(event.target.value as DocumentStudioTabId)}
    value={activeTab}
  >
    {DOCUMENT_STUDIO_TABS.map((tab) => (
      <option key={tab.id} value={tab.id}>
        {tab.label}
      </option>
    ))}
  </select>
</label>
```

- [ ] **Step 4: Replace the old horizontal-scroll mobile treatment**

Update the Document Studio CSS so:

- `.incident-work-header` is an open, document-oriented surface with fine dividers and no large shadow;
- `.incident-next-action` uses a navy action button and a restrained gold orientation rule;
- `.document-studio-tabs` remains visible above the mobile breakpoint;
- `.document-studio-mobile-select` is hidden by default and displayed at the mobile breakpoint;
- the old `overflow-x: auto`, tab minimum width, and hidden tab-description mobile rules are removed;
- `.document-studio-panel` uses a smaller radius and no large shadow;
- nested `.document-studio-subsection` and paperwork capability groups use divider-led layout rather than nested cards;
- `prefers-reduced-motion` disables tab/button travel;
- 44-pixel control minimums and visible focus outlines remain.

- [ ] **Step 5: Run focused tests and confirm GREEN**

Run:

```bash
npx vitest run src/features/incidents/document-studio.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit the task**

```bash
git add src/features/incidents/document-studio.tsx \
  src/features/incidents/document-studio.test.tsx \
  src/app/globals.css
git commit -m "style: quiet Document Studio and clarify mobile sections"
```

### Task 5: Update authenticated browser expectations and run the full gate

**Files:**
- Modify: `tests/e2e/authenticated-report-workspace.spec.ts`
- Modify: `docs/product/experience-design-brief.md`

**Interfaces:**
- Browser qualification expects Reports as the initial section.
- Product documentation records the four-section Document Studio hierarchy and truthful next-action rule.

- [ ] **Step 1: Update the authenticated browser flow**

Replace the comments and obsolete click that assume Overview is initial. After opening the incident, assert:

```ts
await expect(
  page.getByRole("tab", { name: /^Reports/ }),
).toHaveAttribute("aria-selected", "true");
await expect(page.getByText(/request the first officer report/i)).toBeVisible();
```

Keep the existing radio, fact scoping, checkbox, mobile overflow, report finalization, revision, export, print, and administrator checks. Continue clicking Notes & Facts for the later scoping assertion.

- [ ] **Step 2: Update the approved experience brief**

Add a short Document Studio subsection stating:

- four top-level sections are Reports, Notes & Facts, Paperwork, and Incident Record;
- Reports opens first;
- Copy to Records stays subordinate while unavailable;
- next action must be derived from authorized state and must not claim completion or filing;
- mobile uses a labeled section selector rather than a horizontal scrolling tab rail.

- [ ] **Step 3: Run formatting and focused verification**

Run:

```bash
npm run format:check
npm run lint
npm run typecheck
npx vitest run \
  src/features/incidents/derive-incident-next-action.test.ts \
  src/features/incidents/document-studio.test.tsx
```

Expected: all commands exit 0.

- [ ] **Step 4: Run the full local web gate**

Run:

```bash
npm run check
```

Expected: formatting, ESLint, TypeScript, all Vitest and operations tests, and the optimized Next.js production build exit 0.

- [ ] **Step 5: Run authenticated browser qualification when the local Supabase stack is available**

Run:

```bash
npm run test:e2e:local-auth
```

Expected: the authenticated report workspace flow passes at desktop and 390-pixel mobile width with no browser console errors, failed requests, or horizontal page overflow.

If the local stack is unavailable, record that exact infrastructure limitation in the pull request and do not claim authenticated browser qualification.

- [ ] **Step 6: Review the final diff against the design spec**

Verify all of these directly in the diff and fresh command output:

- four top-level sections only;
- Reports selected initially;
- next-action branches covered;
- Copy to Records nested under Reports;
- Incident Record includes overview and history;
- mobile select replaces horizontal tab scrolling;
- existing fact scoping and report workflows remain;
- no server, authorization, database, or deployment changes.

- [ ] **Step 7: Commit the task**

```bash
git add tests/e2e/authenticated-report-workspace.spec.ts \
  docs/product/experience-design-brief.md
git commit -m "test: qualify the guided Document Studio flow"
```
