import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { requestAdminStepUp } from "./request-admin-step-up";
const account = {
  auth_user_id: "11111111-1111-4111-8111-111111111111",
  facility_id: "22222222-2222-4222-8222-222222222222",
  role: "administrator",
  status: "active",
  auth_version: 1,
  must_change_passcode: false,
};
function client(role = "administrator") {
  return {
    auth: {
      getClaims: vi.fn().mockResolvedValue({
        data: {
          claims: {
            sub: account.auth_user_id,
            session_id: "33333333-3333-4333-8333-333333333333",
            app_metadata: { auth_version: 1 },
          },
        },
        error: null,
      }),
    },
    rpc: vi
      .fn()
      .mockResolvedValue({ data: [{ ...account, role }], error: null }),
  };
}
function deps() {
  return {
    verifier: { verify: vi.fn().mockResolvedValue(true) },
    store: { issue: vi.fn().mockResolvedValue(undefined), consume: vi.fn() },
    hmacKey: "x".repeat(32),
    now: () => new Date("2026-08-26T12:00:00Z"),
  };
}
describe("requestAdminStepUp", () => {
  it("requires a current administrator and fresh passcode before storing a one-time proof", async () => {
    const d = deps();
    const result = await requestAdminStepUp(
      client(),
      "account.create",
      { passcode: "Cedar7!9" },
      d,
    );
    expect(result.status).toBe("issued");
    expect(d.verifier.verify).toHaveBeenCalledWith(
      account.auth_user_id,
      "Cedar7!9",
    );
    expect(d.store.issue).toHaveBeenCalledWith(
      expect.objectContaining({
        purpose: "account.create",
        tokenDigest: expect.any(String),
      }),
    );
  });
  it("does not check a passcode for an officer", async () => {
    const d = deps();
    await expect(
      requestAdminStepUp(
        client("officer"),
        "account.create",
        { passcode: "Cedar7!9" },
        d,
      ),
    ).resolves.toEqual({ status: "denied" });
    expect(d.verifier.verify).not.toHaveBeenCalled();
  });
});
