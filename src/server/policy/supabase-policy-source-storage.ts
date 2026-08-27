import "server-only";

import type { PolicySourceStorageReader } from "./policy-source-reader";

type UserBoundStorageClient = Readonly<{
  storage: Readonly<{
    from(bucket: "policy-sources"): Readonly<{
      download(
        path: string,
      ): Promise<Readonly<{ data: Blob | null; error: unknown | null }>>;
    }>;
  }>;
}>;

/**
 * Returns a deliberately narrow reader bound to the current user's Supabase
 * session. Storage RLS independently rechecks that the exact object remains
 * readable when the download begins.
 */
export function createSupabasePolicySourceStorageReader(
  client: UserBoundStorageClient,
): PolicySourceStorageReader {
  return {
    async download(bucket, path) {
      const result = await client.storage.from(bucket).download(path);
      return { data: result.data, error: result.error };
    },
  };
}
