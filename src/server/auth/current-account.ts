export type AccountRole = "officer" | "administrator";
export type AccountStatus = "pending" | "active" | "locked" | "disabled";

/**
 * The trusted, minimal account state loaded by server-side request services.
 * It intentionally excludes employee identifiers, aliases, and passcodes.
 */
export type CurrentAccount = Readonly<{
  authUserId: string;
  facilityId: string;
  role: AccountRole;
  status: AccountStatus;
  authVersion: number;
  mustChangePasscode: boolean;
}>;

export type AccountGateResult =
  | Readonly<{ allowed: true; account: CurrentAccount }>
  | Readonly<{
      allowed: false;
      reason:
        | "missing_account"
        | "session_revoked"
        | "account_inactive"
        | "passcode_change_required"
        | "insufficient_role";
    }>;

type AccountGateOptions = Readonly<{
  requiredRole?: AccountRole;
  /** The passcode-change route is the only protected route allowed before it. */
  allowForcedPasscodeChange?: boolean;
}>;

function roleMeetsRequirement(
  actual: AccountRole,
  required: AccountRole | undefined,
): boolean {
  if (!required) return true;
  return actual === "administrator" || actual === required;
}

/**
 * Rechecks application authority rather than trusting stale JWT claims. The
 * caller maps a denied result to an endpoint-appropriate generic response.
 */
export function checkCurrentAccount(
  account: CurrentAccount | null,
  sessionAuthVersion: number,
  options: AccountGateOptions = {},
): AccountGateResult {
  if (!account) return { allowed: false, reason: "missing_account" };

  if (account.authVersion !== sessionAuthVersion) {
    return { allowed: false, reason: "session_revoked" };
  }

  if (account.status !== "active") {
    return { allowed: false, reason: "account_inactive" };
  }

  if (account.mustChangePasscode && !options.allowForcedPasscodeChange) {
    return { allowed: false, reason: "passcode_change_required" };
  }

  if (!roleMeetsRequirement(account.role, options.requiredRole)) {
    return { allowed: false, reason: "insufficient_role" };
  }

  return { allowed: true, account };
}
