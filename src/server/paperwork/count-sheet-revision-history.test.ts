import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { APPROVED_COUNT_SHEET_STRUCTURE } from "@/features/count-sheet/approved-structure";
import {
  calculateCountTotals,
  createBlankCountPayload,
} from "@/features/count-sheet/calculations";

import {
  getCountSheetRevisionForCurrentSession,
  listCountSheetRevisionsForCurrentSession,
} from "./count-sheet-revision-history";

const account = {
  auth_user_id: "11111111-1111-4111-8111-111111111111",
  facility_id: "22222222-2222-4222-8222-222222222222",
  shift_code: "A",
  role: "officer",
  status: "active",
  auth_version: 1,
  must_change_passcode: false,
};
const recordId = "33333333-3333-4333-8333-333333333333";
const payload = createBlankCountPayload(APPROVED_COUNT_SHEET_STRUCTURE);
const validation = calculateCountTotals(
  APPROVED_COUNT_SHEET_STRUCTURE,
  payload,
);
const summary = {
  revision_number: 2,
  reason: "Fictional correction.",
  validation,
  created_at: "2026-08-26T12:00:00Z",
  is_current: true,
  restored_from_revision_number: null,
};
const detail = {
  record_id: recordId,
  work_date: "2026-08-26",
  shift_code: "A",
  current_revision_number: 2,
  revision_number: 1,
  reason: "Fictional initial sheet.",
  structure: APPROVED_COUNT_SHEET_STRUCTURE,
  payload,
  validation,
  restored_from_revision_number: null,
  created_at: "2026-08-26T11:00:00Z",
};

function client({ summaries = [summary], details = [detail] } = {}) {
  return {
    auth: {
      getClaims: vi.fn().mockResolvedValue({
        data: {
          claims: {
            sub: account.auth_user_id,
            session_id: "44444444-4444-4444-8444-444444444444",
            app_metadata: { auth_version: 1 },
          },
        },
        error: null,
      }),
    },
    rpc: vi.fn(async (name: string) => {
      if (name === "current_account") return { data: [account], error: null };
      if (name === "list_count_sheet_revisions")
        return { data: summaries, error: null };
      return { data: details, error: null };
    }),
  };
}

describe("Count Sheet revision history", () => {
  it("lists bounded revision metadata after current-session authorization", async () => {
    await expect(
      listCountSheetRevisionsForCurrentSession(recordId, client() as never),
    ).resolves.toMatchObject({
      kind: "listed",
      revisions: [
        {
          revisionNumber: 2,
          reason: "Fictional correction.",
          isCurrent: true,
        },
      ],
    });
  });

  it("loads and revalidates one immutable historical snapshot", async () => {
    await expect(
      getCountSheetRevisionForCurrentSession(recordId, "1", client() as never),
    ).resolves.toMatchObject({
      kind: "found",
      revision: {
        recordId,
        revisionNumber: 1,
        currentRevisionNumber: 2,
        payload,
      },
    });
  });

  it("fails closed when stored validation does not match the historical payload", async () => {
    await expect(
      getCountSheetRevisionForCurrentSession(
        recordId,
        1,
        client({
          details: [
            { ...detail, validation: { ...validation, housing_total: 999 } },
          ],
        }) as never,
      ),
    ).resolves.toEqual({ kind: "unavailable" });
  });
});
