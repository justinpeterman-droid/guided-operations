import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createReportDraftWorkflow } from "./report-draft-workflow";
import type { ReportDraftRequest } from "@/features/incidents/schema";

const accountRow = {
  auth_user_id: "11111111-1111-4111-8111-111111111111",
  facility_id: "22222222-2222-4222-8222-222222222222",
  role: "officer",
  status: "active",
  auth_version: 1,
  must_change_passcode: false,
};
const source = {
  incident_id: "33333333-3333-4333-8333-333333333333",
  incident_number: "F-DRAFT-001",
  display_name: "Fictional report-draft scenario",
  incident_revision_id: "44444444-4444-4444-8444-444444444444",
  revision_number: 1,
  schema_version: 2,
  reviewed_facts: [
    {
      id: "55555555-5555-4555-8555-555555555555",
      field: "Fictional fact",
      state: "confirmed",
      value: "Fictional confirmed value",
      sourceNoteIds: ["66666666-6666-4666-8666-666666666666"],
      reportingStaffMemberIds: ["55555555-5555-4555-8555-555555555555"],
    },
    {
      id: "77777777-7777-4777-8777-777777777777",
      field: "Fictional missing fact",
      state: "unknown",
      reason: "Not available in this fictional test.",
    },
  ],
};
const request: ReportDraftRequest = {
  schemaVersion: 2 as const,
  incidentId: source.incident_id,
  sourceIncidentRevisionId: source.incident_revision_id,
  reportingStaffMemberId: "55555555-5555-4555-8555-555555555555",
  reportType: "cover_letter",
  confirmedFactIds: [source.reviewed_facts[0].id],
};

function client(revision: unknown = [source]) {
  return {
    auth: {
      getClaims: vi.fn().mockResolvedValue({
        data: {
          claims: {
            sub: accountRow.auth_user_id,
            session_id: "88888888-8888-4888-8888-888888888888",
            app_metadata: { auth_version: 1 },
          },
        },
        error: null,
      }),
    },
    rpc: vi.fn(async (name: string) => {
      if (name === "current_account")
        return { data: [accountRow], error: null };
      return { data: revision, error: null };
    }),
  };
}

describe("report draft workflow", () => {
  it("sends only selected confirmed facts from the authorized immutable revision", async () => {
    const generate = vi.fn().mockResolvedValue({
      paragraphs: [
        {
          text: "Fictional draft paragraph.",
          sourceFactIds: [source.reviewed_facts[0].id],
        },
      ],
    });
    const workflow = createReportDraftWorkflow(
      { providerKey: "fictional", generate },
      { maximumParagraphs: 3, maximumParagraphCharacters: 500 },
    );

    await expect(workflow.draft(request, 1, client())).resolves.toEqual({
      kind: "draft",
      providerKey: "fictional",
      draft: {
        paragraphs: [
          {
            text: "Fictional draft paragraph.",
            sourceFactIds: [source.reviewed_facts[0].id],
          },
        ],
      },
      source: {
        incidentId: source.incident_id,
        sourceIncidentRevisionId: source.incident_revision_id,
        reportingStaffMemberId: request.reportingStaffMemberId,
        reportType: request.reportType,
        confirmedFacts: [
          {
            id: source.reviewed_facts[0].id,
            field: source.reviewed_facts[0].field,
            value: source.reviewed_facts[0].value,
            sourceNoteIds: source.reviewed_facts[0].sourceNoteIds,
          },
        ],
      },
    });
    expect(generate).toHaveBeenCalledWith({
      source: {
        incidentId: source.incident_id,
        sourceIncidentRevisionId: source.incident_revision_id,
        reportType: request.reportType,
        confirmedFacts: [
          {
            id: source.reviewed_facts[0].id,
            field: source.reviewed_facts[0].field,
            value: source.reviewed_facts[0].value,
            sourceNoteIds: source.reviewed_facts[0].sourceNoteIds,
          },
        ],
      },
      maximumParagraphs: 3,
      maximumParagraphCharacters: 500,
    });
    expect(generate.mock.calls[0][0].source).not.toHaveProperty(
      "reportingStaffMemberId",
    );
  });

  it("does not call the provider when the requested revision ID does not match", async () => {
    const generate = vi.fn();
    const workflow = createReportDraftWorkflow(
      { providerKey: "fictional", generate },
      { maximumParagraphs: 3, maximumParagraphCharacters: 500 },
    );

    await expect(
      workflow.draft(
        {
          ...request,
          sourceIncidentRevisionId: "99999999-9999-4999-8999-999999999999",
        },
        1,
        client(),
      ),
    ).resolves.toEqual({ kind: "not_found" });
    expect(generate).not.toHaveBeenCalled();
  });

  it("does not call the provider for a concealed revision", async () => {
    const generate = vi.fn();
    const workflow = createReportDraftWorkflow(
      { providerKey: "fictional", generate },
      { maximumParagraphs: 3, maximumParagraphCharacters: 500 },
    );

    await expect(workflow.draft(request, 1, client([]))).resolves.toEqual({
      kind: "not_found",
    });
    expect(generate).not.toHaveBeenCalled();
  });

  it("does not call the provider when a fact belongs only to another reporter", async () => {
    const generate = vi.fn();
    const workflow = createReportDraftWorkflow(
      { providerKey: "fictional", generate },
      { maximumParagraphs: 3, maximumParagraphCharacters: 500 },
    );
    const mismatchedSource = {
      ...source,
      reviewed_facts: [
        {
          ...source.reviewed_facts[0],
          reportingStaffMemberIds: ["99999999-9999-4999-8999-999999999999"],
        },
        source.reviewed_facts[1],
      ],
    };

    await expect(
      workflow.draft(request, 1, client([mismatchedSource])),
    ).resolves.toEqual({ kind: "not_found" });
    expect(generate).not.toHaveBeenCalled();
  });
});
