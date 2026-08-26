import { describe, expect, it } from "vitest";

import { checkCurrentAccount, type CurrentAccount } from "./current-account";

const activeOfficer: CurrentAccount = {
  authUserId: "8d2e1bbd-9f5b-4a2f-8f31-df48b5160420",
  facilityId: "7d2e1bbd-9f5b-4a2f-8f31-df48b5160420",
  role: "officer",
  status: "active",
  authVersion: 3,
  mustChangePasscode: false,
};

describe("checkCurrentAccount", () => {
  it("does not authorize a missing application account", () => {
    expect(checkCurrentAccount(null, 3)).toEqual({
      allowed: false,
      reason: "missing_account",
    });
  });

  it("rejects a stale session after an account lifecycle change", () => {
    expect(checkCurrentAccount(activeOfficer, 2)).toEqual({
      allowed: false,
      reason: "session_revoked",
    });
  });

  it.each(["pending", "locked", "disabled"] as const)(
    "rejects a %s account",
    (status) => {
      expect(checkCurrentAccount({ ...activeOfficer, status }, 3)).toEqual({
        allowed: false,
        reason: "account_inactive",
      });
    },
  );

  it("limits a forced-passcode session to the change flow", () => {
    const account = { ...activeOfficer, mustChangePasscode: true };

    expect(checkCurrentAccount(account, 3)).toEqual({
      allowed: false,
      reason: "passcode_change_required",
    });
    expect(
      checkCurrentAccount(account, 3, { allowForcedPasscodeChange: true }),
    ).toEqual({ allowed: true, account });
  });

  it("requires administrator authority where requested", () => {
    expect(
      checkCurrentAccount(activeOfficer, 3, { requiredRole: "administrator" }),
    ).toEqual({ allowed: false, reason: "insufficient_role" });

    const administrator = { ...activeOfficer, role: "administrator" as const };
    expect(
      checkCurrentAccount(administrator, 3, { requiredRole: "administrator" }),
    ).toEqual({ allowed: true, account: administrator });
  });
});
