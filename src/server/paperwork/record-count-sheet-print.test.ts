import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { recordCountSheetPrintForCurrentSession } from "./record-count-sheet-print";

const command = {
  recordId: "33333333-3333-4333-8333-333333333333",
  revisionNumber: 3,
  idempotencyKey: "fictional-print-key-1234",
  requestId: "44444444-4444-4444-8444-444444444444",
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
            session_id: "55555555-5555-4555-8555-555555555555",
            app_metadata: { auth_version: 1 },
          },
        },
        error: null,
      }),
    },
    rpc: vi.fn(async (name: string, args?: Record<string, unknown>) => {
      void args;
      return name === "current_account"
        ? { data: [account], error: null }
        : result;
    }),
  };
}

describe("recordCountSheetPrintForCurrentSession", () => {
  it("hashes retry material and records only an opaque print audit request", async () => {
    const current = client({
      data: "66666666-6666-4666-8666-666666666666",
      error: null,
    });
    await expect(
      recordCountSheetPrintForCurrentSession(
        command,
        current as never,
        "k".repeat(32),
      ),
    ).resolves.toEqual({ kind: "recorded" });
    expect(current.rpc).toHaveBeenCalledWith(
      "record_count_sheet_print",
      expect.objectContaining({
        p_record_id: command.recordId,
        p_revision_number: 3,
        p_idempotency_key_digest: expect.stringMatching(/^[a-f0-9]{64}$/),
        p_request_digest: expect.stringMatching(/^[a-f0-9]{64}$/),
        p_request_id: command.requestId,
      }),
    );
  });

  it("preserves a stale-revision conflict so the browser does not print it", async () => {
    await expect(
      recordCountSheetPrintForCurrentSession(
        command,
        client({ data: null, error: { code: "40001" } }) as never,
        "k".repeat(32),
      ),
    ).resolves.toEqual({ kind: "conflict" });
  });

  it("keeps request correlation out of the retry identity", async () => {
    const first = client({
      data: "66666666-6666-4666-8666-666666666666",
      error: null,
    });
    const retry = client({
      data: "66666666-6666-4666-8666-666666666666",
      error: null,
    });
    await recordCountSheetPrintForCurrentSession(
      command,
      first as never,
      "k".repeat(32),
    );
    await recordCountSheetPrintForCurrentSession(
      {
        ...command,
        requestId: "77777777-7777-4777-8777-777777777777",
      },
      retry as never,
      "k".repeat(32),
    );

    const firstArgs = first.rpc.mock.calls.find(
      ([name]) => name === "record_count_sheet_print",
    )?.[1];
    const retryArgs = retry.rpc.mock.calls.find(
      ([name]) => name === "record_count_sheet_print",
    )?.[1];
    expect(retryArgs?.p_request_digest).toBe(firstArgs?.p_request_digest);
    expect(retryArgs?.p_request_id).not.toBe(firstArgs?.p_request_id);
  });
});
