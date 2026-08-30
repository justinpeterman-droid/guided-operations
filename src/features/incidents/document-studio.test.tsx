import { render, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/app/incidents/[incidentId]/report-draft-request-form", () => ({
  ReportDraftRequestForm: () => (
    <p role="note">Draft request form placeholder</p>
  ),
}));

import { DocumentStudio } from "./document-studio";

const workspace = {
  incidentId: "11111111-1111-4111-8111-111111111111",
  incidentNumber: "F-PAGE-001",
  displayName: "Fictional protected incident",
  category: "incident_no_disciplinary",
  incidentRevisionId: "22222222-2222-4222-8222-222222222222",
  revisionNumber: 1,
  schemaVersion: 2 as const,
  reviewedFacts: [
    {
      id: "33333333-3333-4333-8333-333333333333",
      field: "Location",
      state: "confirmed" as const,
      value: "8 Barracks",
      sourceNoteIds: ["44444444-4444-4444-8444-444444444444"],
      reportingStaffMemberIds: ["55555555-5555-4555-8555-555555555555"],
    },
  ],
  reportingOfficers: [
    {
      staffMemberId: "55555555-5555-4555-8555-555555555555",
      displayName: "Fictional Officer",
      employeeNumberHint: "1234",
      shiftCode: "A" as const,
    },
  ],
};

const incident = {
  incidentId: workspace.incidentId,
  incidentNumber: workspace.incidentNumber,
  displayName: workspace.displayName,
  status: "in_review" as const,
  occurredAt: "2026-08-27T12:00:00.000Z",
  category: workspace.category,
  currentRevisionNumber: 1,
  updatedAt: "2026-08-27T12:30:00.000Z",
};

describe("DocumentStudio", () => {
  it("shows overview data and switches tabs without losing the incident context", async () => {
    const user = userEvent.setup();
    const view = render(
      <DocumentStudio incident={incident} reports={[]} workspace={workspace} />,
    );
    const root = within(view.container);

    expect(root.getByText("Incident (No Disciplinary)")).toBeVisible();
    expect(root.getByText("F-PAGE-001")).toBeVisible();

    await user.click(root.getByRole("tab", { name: /Notes & Facts/i }));
    expect(root.getByText("8 Barracks")).toBeVisible();
    expect(root.getByText(/Raw field notes stay server-side/i)).toBeVisible();

    await user.click(root.getByRole("tab", { name: /Officer Reports/i }));
    await user.keyboard("{ArrowRight}");
    expect(root.getByRole("tab", { name: /Copy to Records/i })).toHaveFocus();
    expect(
      root.getByText(/Copy-to-records output is not yet available/i),
    ).toBeVisible();
  });
});
