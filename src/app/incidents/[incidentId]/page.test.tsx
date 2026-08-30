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
      category: "training",
      incidentRevisionId: "22222222-2222-4222-8222-222222222222",
      revisionNumber: 1,
      schemaVersion: 2,
      reviewedFacts: [],
      reportingOfficers: [],
    },
  }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import IncidentReportWorkspacePage from "./page";

describe("IncidentReportWorkspacePage", () => {
  it("renders the protected current revision without fictional fallback data", async () => {
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
    expect(screen.getByText(/F-PAGE-001/)).toBeVisible();
    expect(screen.getByText(/No active reporting officer/)).toBeVisible();
  });
});
