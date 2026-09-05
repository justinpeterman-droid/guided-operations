import "server-only";

/**
 * Cookie-authenticated mutations must have an exact Origin match. SameSite
 * cookies and Fetch Metadata are defense in depth, not substitutes for this
 * check.
 *
 * Local development is the one deliberate exception: browsers may send
 * http://localhost:PORT while APP_ORIGIN is http://127.0.0.1:PORT (or the
 * reverse). Next also normalizes nextUrl.hostname to "localhost" for both,
 * so host redirects cannot fix this. Treat loopback hostnames as equivalent
 * only when protocol and port already match.
 */
export function isTrustedMutationRequest(
  request: Pick<Request, "headers">,
  applicationOrigin: string,
): boolean {
  const origin = request.headers.get("origin");
  if (!originsMatchForTrustedMutation(origin, applicationOrigin)) {
    return false;
  }

  return request.headers.get("sec-fetch-site") !== "cross-site";
}

function originsMatchForTrustedMutation(
  origin: string | null,
  applicationOrigin: string,
): boolean {
  if (origin === null) return false;
  if (origin === applicationOrigin) return true;

  let requestUrl: URL;
  let applicationUrl: URL;
  try {
    requestUrl = new URL(origin);
    applicationUrl = new URL(applicationOrigin);
  } catch {
    return false;
  }

  if (
    requestUrl.protocol !== applicationUrl.protocol ||
    requestUrl.port !== applicationUrl.port
  ) {
    return false;
  }

  return (
    isLoopbackHostname(requestUrl.hostname) &&
    isLoopbackHostname(applicationUrl.hostname)
  );
}

function isLoopbackHostname(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    hostname === "::1"
  );
}
