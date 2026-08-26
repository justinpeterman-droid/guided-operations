import "server-only";

import {
  checkCurrentAccount,
  type AccountGateOptions,
  type AccountGateResult,
  type CurrentAccount,
} from "./current-account";
import {
  loadCurrentAccountFromRpc,
  type CurrentAccountRpcClient,
} from "./current-account-rpc";
import { parseSessionAuthority } from "./session-claims";

type ClaimsClient = Readonly<{
  auth: Readonly<{
    getClaims(): Promise<
      Readonly<{
        data: Readonly<{ claims?: unknown }> | null;
        error: unknown | null;
      }>
    >;
  }>;
}>;

export type CurrentSessionClient = ClaimsClient & CurrentAccountRpcClient;

export type CurrentSessionGateResult =
  | Readonly<{
      allowed: true;
      account: CurrentAccount;
      sessionId: string;
    }>
  | Exclude<AccountGateResult, Readonly<{ allowed: true }>>;

/**
 * Verifies provider-issued JWT claims, loads authoritative application state,
 * and applies the current-account gate. A claim/RPC mismatch is always denied.
 */
export async function authorizeCurrentSession(
  client: CurrentSessionClient,
  options: AccountGateOptions = {},
): Promise<CurrentSessionGateResult> {
  try {
    const claimsResult = await client.auth.getClaims();
    if (claimsResult.error)
      return { allowed: false, reason: "missing_account" };

    const authority = parseSessionAuthority(claimsResult.data?.claims);
    if (!authority) return { allowed: false, reason: "session_revoked" };

    const account = await loadCurrentAccountFromRpc(client);
    if (!account || account.authUserId !== authority.authUserId) {
      return { allowed: false, reason: "missing_account" };
    }

    const gate = checkCurrentAccount(account, authority.authVersion, options);
    return gate.allowed ? { ...gate, sessionId: authority.sessionId } : gate;
  } catch {
    return { allowed: false, reason: "missing_account" };
  }
}
