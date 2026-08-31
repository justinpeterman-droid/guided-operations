import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const serverClient = {};
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue(serverClient),
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
vi.mock("@/server/incidents/get-incident-summary", () => ({
  getIncidentSummaryForCurrentSession: vi.fn().mockResolvedValue({
    kind: "found",
    incident: {
      incidentId: "11111111-1111-4111-8111-111111111111",
      incidentNumber: "F-PAGE-001",
      displayName: "Fictional protected incident",
      status: "in_review",
      occurredAt: "2026-08-30T12:00:00Z",
      category: "incident_no_disciplinary",
      currentRevisionNumber: 1,
      updatedAt: "2026-08-30T13:00:00Z",
    },
  }),
}));
vi.mock("@/server/incidents/list-incident-reports", () => ({
  listReportsForIncidentForCurrentSession: vi.fn().mockResolvedValue({
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

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getIncidentReportWorkspaceForCurrentSession } from "@/server/incidents/get-incident-report-workspace";
import { getIncidentSummaryForCurrentSession } from "@/server/incidents/get-incident-summary";
import { listReportsForIncidentForCurrentSession } from "@/server/incidents/list-incident-reports";

import IncidentReportWorkspacePage from "./page";

const INCIDENT_ID = "11111111-1111-4111-8111-111111111111";

describe("IncidentReportWorkspacePage", () => {
  it("renders Document Studio from incident-scoped reads using one server client", async () => {
    const user = userEvent.setup();
    render(
      await IncidentReportWorkspacePage({
        params: Promise.resolve({ incidentId: INCIDENT_ID }),
      }),
    );

    expect(
      screen.getByRole("heading", { name: "Fictional protected incident" }),
    ).toBeVisible();
    expect(screen.getAllByText(/F-PAGE-001/).length).toBeGreaterThan(0);
    expect(
      screen.getByRole("tablist", { name: "Document Studio sections" }),
    ).toBeVisible();
    expect(screen.getByText("in review")).toBeVisible();
    expect(createSupabaseServerClient).toHaveBeenCalledTimes(1);
    expect(getIncidentReportWorkspaceForCurrentSession).toHaveBeenCalledWith(
      INCIDENT_ID,
      serverClient,
    );
    expect(getIncidentSummaryForCurrentSession).toHaveBeenCalledWith(
      INCIDENT_ID,
      serverClient,
    );
    expect(listReportsForIncidentForCurrentSession).toHaveBeenCalledWith(
      INCIDENT_ID,
      serverClient,
    );

    expect(screen.getByRole("tab", { name: /Officer Reports/i })).toBeVisible();
    await user.click(screen.getByRole("tab", { name: /Officer Reports/i }));
    expect(screen.getByText(/No active reporting officer/)).toBeVisible();
  });
});
