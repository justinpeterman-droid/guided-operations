import { render, waitFor, within } from "@testing-library/react";
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

import { DOCUMENT_STUDIO_TABS } from "./document-studio-catalog";
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

const report = {
  reportId: "66666666-6666-4666-8666-666666666666",
  incidentNumber: workspace.incidentNumber,
  incidentName: workspace.displayName,
  reportType: "first_person" as const,
  status: "complete" as const,
  currentRevisionNumber: 2,
  updatedAt: "2026-08-27T13:00:00.000Z",
};

describe("DocumentStudio", () => {
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
    expect(root.getByRole("note")).toHaveTextContent(
      "Draft request form placeholder",
    );
    expect(
      root.getByText(/Copy-to-records output is not yet available/i),
    ).toBeVisible();
    expect(root.queryByRole("tab", { name: /Overview/i })).toBeNull();
    expect(root.queryByRole("tab", { name: /Copy to Records/i })).toBeNull();
    expect(root.queryByRole("tab", { name: /^History/i })).toBeNull();

    await user.click(root.getByRole("button", { name: "Open Reports" }));
    await waitFor(() =>
      expect(root.getByRole("heading", { name: "Reports" })).toHaveFocus(),
    );
  });

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

  it("lets the tab list own exactly the four approved tabs", () => {
    const view = render(
      <DocumentStudio incident={incident} reports={[]} workspace={workspace} />,
    );
    const root = within(view.container);

    const tablist = root.getByRole("tablist");
    expect(tablist.tagName).toBe("UL");
    expect(root.getAllByRole("tab")).toHaveLength(DOCUMENT_STUDIO_TABS.length);
    expect(DOCUMENT_STUDIO_TABS).toHaveLength(4);
  });

  it("keeps every section control pointed at the rendered tab panel", async () => {
    const user = userEvent.setup();
    const view = render(
      <DocumentStudio incident={incident} reports={[]} workspace={workspace} />,
    );
    const root = within(view.container);

    for (const tab of DOCUMENT_STUDIO_TABS) {
      await user.click(
        root.getByRole("tab", { name: new RegExp(tab.label, "i") }),
      );
      const panel = root.getByRole("tabpanel");
      for (const button of root.getAllByRole("tab")) {
        expect(
          view.container.querySelector(
            `#${button.getAttribute("aria-controls")}`,
          ),
        ).toBe(panel);
      }
      expect(panel).toHaveAttribute(
        "aria-labelledby",
        `document-studio-tab-${tab.id}`,
      );
    }
  });

  it("supports keyboard movement across the four task sections", async () => {
    const user = userEvent.setup();
    const view = render(
      <DocumentStudio incident={incident} reports={[]} workspace={workspace} />,
    );
    const root = within(view.container);
    const reportsTab = root.getByRole("tab", { name: /^Reports/i });

    reportsTab.focus();
    await user.keyboard("{ArrowRight}");
    expect(root.getByRole("tab", { name: /Notes & Facts/i })).toHaveFocus();
    expect(root.getByText("8 Barracks")).toBeVisible();
  });

  it("combines incident overview and report revision heads in Incident Record", async () => {
    const user = userEvent.setup();
    const view = render(
      <DocumentStudio
        incident={incident}
        reports={[report]}
        workspace={workspace}
      />,
    );
    const root = within(view.container);

    await user.click(root.getByRole("tab", { name: /Incident Record/i }));
    expect(
      root.getByRole("heading", { name: "Incident Record" }),
    ).toBeVisible();
    expect(root.getByText("Current incident revision")).toBeVisible();
    expect(root.getByText("Revision 1 is the active revision for this incident."))
      .toBeVisible();
    expect(root.getByRole("link", { name: "Open report history" })).toBeVisible();
  });

  it("groups paperwork by honest digital capability", async () => {
    const user = userEvent.setup();
    const view = render(
      <DocumentStudio
        incident={{ ...incident, category: "contraband" }}
        reports={[]}
        workspace={{ ...workspace, category: "contraband" }}
      />,
    );
    const root = within(view.container);

    await user.click(root.getByRole("tab", { name: /^Paperwork/i }));
    expect(
      root.getByRole("heading", {
        name: "Available through Officer Reports",
      }),
    ).toBeVisible();
    expect(
      root.getByRole("heading", { name: "Physical form required" }),
    ).toBeVisible();
    expect(
      root.getByRole("heading", {
        name: "Digital support not yet available",
      }),
    ).toBeVisible();
  });

  it("keeps a fact that belongs to no reporting officer off Notes & Facts", async () => {
    const user = userEvent.setup();
    const view = render(
      <DocumentStudio
        incident={incident}
        reports={[]}
        workspace={{
          ...workspace,
          reviewedFacts: [
            ...workspace.reviewedFacts,
            {
              id: "99999999-9999-4999-8999-999999999999",
              field: "Unassigned observation",
              state: "confirmed" as const,
              value: "Confirmed fact that is not assigned to any reporter.",
              sourceNoteIds: ["44444444-4444-4444-8444-444444444444"],
              reportingStaffMemberIds: [],
            },
          ],
        }}
      />,
    );
    const root = within(view.container);

    await user.click(root.getByRole("tab", { name: /Notes & Facts/i }));
    expect(root.getByText("Location")).toBeVisible();
    expect(root.queryByText("Unassigned observation")).toBeNull();
  });
});
