import "server-only";

import {
  authorizeCurrentSession,
  type CurrentSessionClient,
} from "@/server/auth/current-session";
import type { AccountGateOptions } from "@/server/auth/current-account";

import {
  hasValidSessionCsrfToken,
  issueSessionCsrfToken,
  readSessionCsrfToken,
  type IssuedCsrfToken,
} from "./session-csrf";

type RequestHeaders = Pick<Headers, "get">;

export type CsrfEndpointResult =
  | Readonly<{ kind: "issued"; token: IssuedCsrfToken }>
  | Readonly<{ kind: "reused"; token: string }>
  | Readonly<{ kind: "denied" }>;

/** Returns a valid CSRF token only after the current-session gate succeeds. */
export async function issueCsrfForCurrentSession(
  client: CurrentSessionClient,
  hmacKey: string,
  options: AccountGateOptions = {},
  headers?: RequestHeaders,
): Promise<CsrfEndpointResult> {
  const session = await authorizeCurrentSession(client, options);
  if (!session.allowed) return { kind: "denied" };

  const existingToken = headers ? readSessionCsrfToken(headers) : null;
  if (
    existingToken &&
    headers &&
    hasValidSessionCsrfToken(existingToken, headers, session.sessionId, hmacKey)
  ) {
    return { kind: "reused", token: existingToken };
  }

  return {
    kind: "issued",
    token: issueSessionCsrfToken(session.sessionId, hmacKey),
  };
}
