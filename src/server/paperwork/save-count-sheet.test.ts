import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { saveCountSheetForCurrentSession } from "./save-count-sheet";
import { APPROVED_COUNT_SHEET_STRUCTURE } from "@/features/count-sheet/approved-structure";
import { createBlankCountPayload } from "@/features/count-sheet/calculations";

const payload = createBlankCountPayload(APPROVED_COUNT_SHEET_STRUCTURE);
payload.cells["Chow Hall"]["1"] = 2;
payload.in_housing["1"] = 8;
payload.operational.on_site = 10;

const command = {
  workDate: "2026-08-26",
  baseRevisionNumber: 0,
  structure: APPROVED_COUNT_SHEET_STRUCTURE,
  payload,
  reason: "Fictional initial shift count.",
  idempotencyKey: "fictional-count-sheet-retry-key-1234",
};

function client(
  claims: unknown = {
    sub: "22222222-2222-4222-8222-222222222222",
    session_id: "33333333-3333-4333-8333-333333333333",
    app_metadata: { auth_version: 1 },
  },
) {
  const account = {
    auth_user_id: "22222222-2222-4222-8222-222222222222",
    facility_id: "44444444-4444-4444-8444-444444444444",
    shift_code: "A",
    role: "officer",
    status: "active",
    auth_version: 1,
    must_change_passcode: false,
  };
  return {
    auth: {
      getClaims: vi.fn().mockResolvedValue({ data: { claims }, error: null }),
    },
    rpc: vi.fn(async (name: string) =>
      name === "current_account"
        ? { data: [account], error: null }
        : {
            data: [
              {
                record_id: "55555555-5555-4555-8555-555555555555",
                revision_number: 1,
              },
            ],
            error: null,
          },
    ),
  };
}

describe("saveCountSheetForCurrentSession", () => {
  it("validates a fictional sheet and maps it to the narrow save RPC", async () => {
    const current = client();

    await expect(
      saveCountSheetForCurrentSession(
        command,
        current,
        "a-32-byte-fixture-idempotency-hmac-key",
      ),
    ).resolves.toEqual({
      kind: "saved",
      recordId: "55555555-5555-4555-8555-555555555555",
      revisionNumber: 1,
    });

    expect(current.rpc).toHaveBeenLastCalledWith(
      "save_count_sheet",
      expect.objectContaining({
        p_work_date: command.workDate,
        p_base_revision_number: 0,
        p_structure: command.structure,
        p_payload: command.payload,
        p_reason: command.reason,
      }),
    );
  });

  it("denies an invalid count payload before the database RPC", async () => {
    const current = client();

    await expect(
      saveCountSheetForCurrentSession(
        {
          ...command,
          payload: {
            ...command.payload,
            operational: { on_site: -1 },
          },
        },
        current,
        "a-32-byte-fixture-idempotency-hmac-key",
      ),
    ).resolves.toEqual({ kind: "denied" });

    expect(current.rpc).not.toHaveBeenCalledWith(
      "save_count_sheet",
      expect.anything(),
    );
  });

  it("maps a stale base revision to a conflict", async () => {
    const current = client();
    current.rpc.mockImplementation((async (name: string) =>
      name === "current_account"
        ? {
            data: [
              {
                auth_user_id: "22222222-2222-4222-8222-222222222222",
                facility_id: "44444444-4444-4444-8444-444444444444",
                shift_code: "A",
                role: "officer",
                status: "active",
                auth_version: 1,
                must_change_passcode: false,
              },
            ],
            error: null,
          }
        : { data: null, error: { code: "40001" } }) as never);

    await expect(
      saveCountSheetForCurrentSession(
        command,
        current,
        "a-32-byte-fixture-idempotency-hmac-key",
      ),
    ).resolves.toEqual({ kind: "conflict" });
  });
});
