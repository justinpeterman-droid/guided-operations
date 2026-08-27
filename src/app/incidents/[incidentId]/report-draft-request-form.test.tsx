import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

import type { IncidentReportWorkspace } from "@/server/incidents/get-incident-report-workspace";

import { ReportDraftRequestForm } from "./report-draft-request-form";

const officerOne = "11111111-1111-4111-8111-111111111111";
const officerTwo = "22222222-2222-4222-8222-222222222222";
const factOne = "33333333-3333-4333-8333-333333333333";
const factTwo = "44444444-4444-4444-8444-444444444444";

const workspace: IncidentReportWorkspace = {
  incidentId: "55555555-5555-4555-8555-555555555555",
  incidentNumber: "F-DRAFT-UI-001",
  displayName: "Fictional draft UI scenario",
  category: "training",
  incidentRevisionId: "66666666-6666-4666-8666-666666666666",
  revisionNumber: 1,
  schemaVersion: 2,
  reviewedFacts: [
    {
      id: factOne,
      field: "Officer one fact",
      state: "confirmed",
      value: "Fictional fact for officer one",
      sourceNoteIds: ["77777777-7777-4777-8777-777777777777"],
      reportingStaffMemberIds: [officerOne],
    },
    {
      id: factTwo,
      field: "Officer two fact",
      state: "confirmed",
      value: "Fictional fact for officer two",
      sourceNoteIds: ["88888888-8888-4888-8888-888888888888"],
      reportingStaffMemberIds: [officerTwo],
    },
  ],
  reportingOfficers: [
    {
      staffMemberId: officerOne,
      displayName: "Fictional Officer One",
      employeeNumberHint: "11",
      shiftCode: "A",
    },
    {
      staffMemberId: officerTwo,
      displayName: "Fictional Officer Two",
      employeeNumberHint: "22",
      shiftCode: "C",
    },
  ],
};

describe("ReportDraftRequestForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("submits only facts scoped to the selected reporting officer", async () => {
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ csrfToken: "csrf-token" }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              candidateId: "99999999-9999-4999-8999-999999999999",
            },
          }),
          { status: 201 },
        ),
      );
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    );
    const user = userEvent.setup();
    render(<ReportDraftRequestForm workspace={workspace} />);

    expect(
      screen.getByRole("button", { name: "Create review draft" }),
    ).toBeDisabled();
    await user.click(
      screen.getByRole("radio", { name: /Fictional Officer One/ }),
    );
    expect(screen.getByText("Officer one fact")).toBeVisible();
    expect(screen.queryByText("Officer two fact")).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("checkbox", { name: /Officer one fact/ }),
    );
    await user.click(
      screen.getByRole("button", { name: "Create review draft" }),
    );

    expect(fetch).toHaveBeenNthCalledWith(1, "/api/auth/csrf", {
      credentials: "same-origin",
      cache: "no-store",
    });
    const [, request] = fetch.mock.calls[1] as [string, RequestInit];
    expect(fetch.mock.calls[1][0]).toBe("/api/web/v1/report-drafts");
    expect(JSON.parse(request.body as string)).toEqual({
      request: {
        schemaVersion: 2,
        incidentId: workspace.incidentId,
        sourceIncidentRevisionId: workspace.incidentRevisionId,
        reportingStaffMemberId: officerOne,
        reportType: "first_person",
        confirmedFactIds: [factOne],
      },
      sourceRevisionNumber: 1,
    });
    expect(push).toHaveBeenCalledWith(
      "/reports/drafts/99999999-9999-4999-8999-999999999999",
    );
  });

  it("does not offer generation for legacy unscoped revisions", () => {
    render(
      <ReportDraftRequestForm workspace={{ ...workspace, schemaVersion: 1 }} />,
    );
    expect(screen.getByText(/older incident remains readable/i)).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Create review draft" }),
    ).not.toBeInTheDocument();
  });
});
