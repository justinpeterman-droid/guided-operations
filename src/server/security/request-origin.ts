import "server-only";

/**
 * Cookie-authenticated mutations must have an exact Origin match. SameSite
 * cookies and Fetch Metadata are defense in depth, not substitutes for this
 * check.
 */
export function isTrustedMutationRequest(
  request: Pick<Request, "headers">,
  applicationOrigin: string,
): boolean {
  const origin = request.headers.get("origin");
  if (origin !== applicationOrigin) return false;

  return request.headers.get("sec-fetch-site") !== "cross-site";
}
