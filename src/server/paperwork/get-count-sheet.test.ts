import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { APPROVED_COUNT_SHEET_STRUCTURE } from "@/features/count-sheet/approved-structure";
import {
  calculateCountTotals,
  createBlankCountPayload,
} from "@/features/count-sheet/calculations";

import { getCurrentShiftCountSheet } from "./get-count-sheet";

const account = {
  auth_user_id: "11111111-1111-4111-8111-111111111111",
  facility_id: "22222222-2222-4222-8222-222222222222",
  shift_code: "A",
  role: "officer",
  status: "active",
  auth_version: 1,
  must_change_passcode: false,
};
const payload = createBlankCountPayload(APPROVED_COUNT_SHEET_STRUCTURE);
const validation = calculateCountTotals(
  APPROVED_COUNT_SHEET_STRUCTURE,
  payload,
);
const summary = {
  record_id: "33333333-3333-4333-8333-333333333333",
  work_date: "2026-08-26",
  shift_code: "A",
  current_revision_number: 2,
  validation,
  updated_at: "2026-08-26T12:00:00Z",
};
const detail = {
  ...summary,
  structure: APPROVED_COUNT_SHEET_STRUCTURE,
  payload,
  created_at: "2026-08-26T11:00:00Z",
};

function client({
  current = account,
  summaries = [summary],
  records = [detail],
}: {
  current?: unknown;
  summaries?: unknown;
  records?: unknown;
} = {}) {
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
      if (name === "current_account") return { data: [current], error: null };
      if (name === "list_count_sheets") return { data: summaries, error: null };
      return { data: records, error: null };
    }),
  };
}

describe("getCurrentShiftCountSheet", () => {
  it("loads one current approved revision for the assigned shift", async () => {
    const current = client();

    await expect(
      getCurrentShiftCountSheet("2026-08-26", current),
    ).resolves.toMatchObject({
      kind: "found",
      countSheet: {
        recordId: summary.record_id,
        shiftCode: "A",
        revisionNumber: 2,
      },
    });
    expect(current.rpc).toHaveBeenCalledWith("get_count_sheet", {
      p_record_id: summary.record_id,
    });
  });

  it("returns a blank approved sheet when the shift has no record", async () => {
    await expect(
      getCurrentShiftCountSheet("2026-08-26", client({ summaries: [] })),
    ).resolves.toMatchObject({
      kind: "empty",
      countSheet: {
        recordId: null,
        shiftCode: "A",
        revisionNumber: 0,
        structure: APPROVED_COUNT_SHEET_STRUCTURE,
      },
    });
  });

  it("fails closed when an administrator has no assigned shift", async () => {
    await expect(
      getCurrentShiftCountSheet(
        "2026-08-26",
        client({
          current: { ...account, role: "administrator", shift_code: null },
        }),
      ),
    ).resolves.toEqual({ kind: "unassigned" });
  });

  it("rejects a stored structure that differs from the approved form", async () => {
    await expect(
      getCurrentShiftCountSheet(
        "2026-08-26",
        client({
          records: [
            {
              ...detail,
              structure: {
                ...APPROVED_COUNT_SHEET_STRUCTURE,
                title: "Unapproved replacement",
              },
            },
          ],
        }),
      ),
    ).resolves.toEqual({ kind: "unavailable" });
  });
});
