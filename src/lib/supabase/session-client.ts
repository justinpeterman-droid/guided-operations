import "server-only";

import { createClient } from "@supabase/supabase-js";

import {
  SUPABASE_SESSION_STORAGE_KEY,
  type EncryptedSupabaseSessionStorage,
} from "@/server/auth/encrypted-supabase-session-storage";

import type { Database } from "./database";

/** One server-only Supabase client contract for sign-in, refresh, and RLS calls. */
export function createSupabaseSessionClient(
  url: string,
  publishableKey: string,
  storage: EncryptedSupabaseSessionStorage,
) {
  return createClient<Database>(url, publishableKey, {
    db: { schema: "api" },
    auth: {
      storageKey: SUPABASE_SESSION_STORAGE_KEY,
      storage,
      autoRefreshToken: false,
      persistSession: true,
      detectSessionInUrl: false,
      flowType: "pkce",
      skipAutoInitialize: true,
    },
  });
}
