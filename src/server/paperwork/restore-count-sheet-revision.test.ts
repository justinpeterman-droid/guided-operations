import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { restoreCountSheetRevisionForCurrentSession } from "./restore-count-sheet-revision";

const command = {
  recordId: "33333333-3333-4333-8333-333333333333",
  baseRevisionNumber: 2,
  restoreRevisionNumber: 1,
  reason: "Return to the earlier fictional count.",
  idempotencyKey: "fictional-restore-key-1234",
};
const account = {
  auth_user_id: "11111111-1111-4111-8111-111111111111",
  facility_id: "22222222-2222-4222-8222-222222222222",
  shift_code: "A",
  role: "officer",
  status: "active",
  auth_version: 1,
  must_change_passcode: false,
};

function client(result: { data: unknown; error: unknown | null }) {
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
    rpc: vi.fn(async (name: string) =>
      name === "current_account" ? { data: [account], error: null } : result,
    ),
  };
}

describe("restoreCountSheetRevisionForCurrentSession", () => {
  it("hashes retry material and creates a new revision through the narrow RPC", async () => {
    const current = client({ data: 3, error: null });
    await expect(
      restoreCountSheetRevisionForCurrentSession(
        command,
        current as never,
        "k".repeat(32),
      ),
    ).resolves.toEqual({ kind: "restored", revisionNumber: 3 });
    expect(current.rpc).toHaveBeenCalledWith(
      "restore_count_sheet_revision",
      expect.objectContaining({
        p_record_id: command.recordId,
        p_base_revision_number: 2,
        p_restore_revision_number: 1,
        p_idempotency_key_digest: expect.stringMatching(/^[a-f0-9]{64}$/),
        p_request_digest: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    );
  });

  it("preserves a database concurrency conflict", async () => {
    await expect(
      restoreCountSheetRevisionForCurrentSession(
        command,
        client({ data: null, error: { code: "40001" } }) as never,
        "k".repeat(32),
      ),
    ).resolves.toEqual({ kind: "conflict" });
  });
});
