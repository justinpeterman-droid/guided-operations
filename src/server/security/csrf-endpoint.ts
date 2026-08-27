import "server-only";

import {
  authorizeCurrentSession,
  type CurrentSessionClient,
} from "@/server/auth/current-session";
import type { AccountGateOptions } from "@/server/auth/current-account";

import { issueSessionCsrfToken, type IssuedCsrfToken } from "./session-csrf";

export type CsrfEndpointResult =
  | Readonly<{ kind: "issued"; token: IssuedCsrfToken }>
  | Readonly<{ kind: "denied" }>;

/** Issues a CSRF pair only after the complete current-session gate succeeds. */
export async function issueCsrfForCurrentSession(
  client: CurrentSessionClient,
  hmacKey: string,
  options: AccountGateOptions = {},
): Promise<CsrfEndpointResult> {
  const session = await authorizeCurrentSession(client, options);
  if (!session.allowed) return { kind: "denied" };

  return {
    kind: "issued",
    token: issueSessionCsrfToken(session.sessionId, hmacKey),
  };
}
