import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  ADMIN_STEP_UP_PURPOSES,
  adminStepUpInternals,
  issueAdminStepUp,
} from "./admin-step-up";

describe("issueAdminStepUp", () => {
  it("creates an opaque five-minute proof with a purpose-bound digest", () => {
    const now = new Date("2026-08-26T18:00:00.000Z");
    const key = "s".repeat(32);
    const issued = issueAdminStepUp("account.disable", key, now);

    expect(issued.token).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(issued.tokenDigest).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(issued.tokenDigest).not.toBe(issued.token);
    expect(issued.expiresAt).toEqual(
      new Date(now.getTime() + adminStepUpInternals.stepUpLifetimeMs),
    );
  });

  it("does not let a proof for one action stand in for another", () => {
    const key = "s".repeat(32);
    const issued = issueAdminStepUp("account.reset_passcode", key);

    expect(
      adminStepUpInternals.digestStepUpToken(
        issued.token,
        "account.reset_passcode",
        key,
      ),
    ).toBe(issued.tokenDigest);
    expect(
      adminStepUpInternals.digestStepUpToken(
        issued.token,
        "account.disable",
        key,
      ),
    ).not.toBe(issued.tokenDigest);
  });

  it("keeps the permitted action list intentionally small", () => {
    expect(ADMIN_STEP_UP_PURPOSES).toEqual([
      "account.create",
      "account.reset_passcode",
      "account.unlock",
      "account.change_role",
      "account.change_shift",
      "account.disable",
      "policy.promote",
      "retention.place_legal_hold",
      "retention.release_legal_hold",
      "system.destructive_cleanup",
    ]);
  });
});
