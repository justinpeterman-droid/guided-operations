import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue({}),
}));
vi.mock("@/server/incidents/get-incident-report-workspace", () => ({
  getIncidentReportWorkspaceForCurrentSession: vi.fn().mockResolvedValue({
    kind: "found",
    workspace: {
      incidentId: "11111111-1111-4111-8111-111111111111",
      incidentNumber: "F-PAGE-001",
      displayName: "Fictional protected incident",
      category: "incident_no_disciplinary",
      incidentRevisionId: "22222222-2222-4222-8222-222222222222",
      revisionNumber: 1,
      schemaVersion: 2,
      reviewedFacts: [],
      reportingOfficers: [],
    },
  }),
}));
vi.mock("@/server/incidents/list-incidents", () => ({
  listIncidentsForCurrentSession: vi.fn().mockResolvedValue({
    kind: "listed",
    incidents: [],
  }),
}));
vi.mock("@/server/incidents/list-reports", () => ({
  listReportsForCurrentSession: vi.fn().mockResolvedValue({
    kind: "listed",
    reports: [],
  }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/app/incidents/[incidentId]/report-draft-request-form", () => ({
  ReportDraftRequestForm: () => (
    <p role="alert">
      No active reporting officer is available on this revision.
    </p>
  ),
}));

import IncidentReportWorkspacePage from "./page";

describe("IncidentReportWorkspacePage", () => {
  it("renders the guided four-section workspace for the protected revision", async () => {
    render(
      await IncidentReportWorkspacePage({
        params: Promise.resolve({
          incidentId: "11111111-1111-4111-8111-111111111111",
        }),
      }),
    );

    expect(
      screen.getByRole("heading", { name: "Fictional protected incident" }),
    ).toBeVisible();
    expect(screen.getAllByText(/F-PAGE-001/).length).toBeGreaterThan(0);
    expect(
      screen.getByRole("tablist", { name: "Document Studio sections" }),
    ).toBeVisible();
    expect(screen.getAllByRole("tab")).toHaveLength(4);
    expect(screen.getByRole("tab", { name: /^Reports/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      screen.getByRole("combobox", { name: "Document Studio section" }),
    ).toHaveValue("reports");
    expect(screen.getByText(/No active reporting officer/)).toBeVisible();
    expect(screen.getByText(/cannot be attributed yet/i)).toBeVisible();
  });
});
