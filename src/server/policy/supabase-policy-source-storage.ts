import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getAuthServerEnvironment } from "@/lib/env/auth-server";
import { getPublicSupabaseEnvironment } from "@/lib/env/supabase-public";

import type { PolicySourceStorageReader } from "./policy-source-reader";

/**
 * Returns a deliberately narrow reader instead of exposing the privileged
 * Supabase client. Call it only after the session-bound database RPC has
 * authorized one exact immutable source path.
 */
export function createSupabasePolicySourceStorageReader(): PolicySourceStorageReader {
  const authEnvironment = getAuthServerEnvironment();
  const publicEnvironment = getPublicSupabaseEnvironment();
  const client = createClient(
    publicEnvironment.NEXT_PUBLIC_SUPABASE_URL,
    authEnvironment.SUPABASE_SECRET_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  return {
    async download(bucket, path) {
      const result = await client.storage.from(bucket).download(path);
      return { data: result.data, error: result.error };
    },
  };
}
