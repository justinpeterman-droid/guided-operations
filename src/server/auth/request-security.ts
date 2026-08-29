import type { HeadersLike } from "./http";

export function mutationRequestIsSameOrigin(
  headers: HeadersLike,
  expectedOrigin: string,
): boolean {
  const origin = headers.get("origin");
  if (origin !== expectedOrigin) {
    return false;
  }

  const fetchSite = headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") {
    return false;
  }

  return true;
}
