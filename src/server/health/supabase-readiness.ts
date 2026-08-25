type FetchResponse = Pick<Response, "ok">;

export async function hasSupabaseReadiness(
  supabaseUrl: string,
  publishableKey: string,
  request: typeof fetch = fetch,
): Promise<boolean> {
  // The Data API root requires a secret key on current hosted projects. Auth's
  // settings endpoint is designed to accept the browser-safe publishable key,
  // so it proves the connected Supabase project is reachable without granting
  // the readiness route access to application data.
  const endpoint = new URL(
    "auth/v1/settings",
    ensureTrailingSlash(supabaseUrl),
  );
  const response: FetchResponse = await request(endpoint, {
    cache: "no-store",
    headers: {
      apikey: publishableKey,
    },
    signal: AbortSignal.timeout(3_000),
  });

  return response.ok;
}

function ensureTrailingSlash(url: string): string {
  return url.endsWith("/") ? url : `${url}/`;
}
