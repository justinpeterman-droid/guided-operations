type FetchResponse = Pick<Response, "ok">;

export async function hasSupabaseReadiness(
  supabaseUrl: string,
  publishableKey: string,
  request: typeof fetch = fetch,
): Promise<boolean> {
  const endpoint = new URL("rest/v1/", ensureTrailingSlash(supabaseUrl));
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
