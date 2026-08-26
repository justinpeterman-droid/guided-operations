import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getAuthServerEnvironment } from "@/lib/env/auth-server";
import { getPublicSupabaseEnvironment } from "@/lib/env/supabase-public";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import type { PasswordAuthenticator } from "./employee-sign-in";

/** Server-only administrative client. Do not use for routine user requests. */
export function createSupabaseAuthAdminClient() {
  const environment = getAuthServerEnvironment();
  const publicEnvironment = getPublicSupabaseEnvironment();

  return createClient(
    publicEnvironment.NEXT_PUBLIC_SUPABASE_URL,
    environment.SUPABASE_SECRET_KEY,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
}

/**
 * Writes successful Supabase Auth sessions through the SSR cookie client. It
 * returns only success/failure, never provider errors, aliases, or users.
 */
export async function createSupabasePasswordAuthenticator(): Promise<PasswordAuthenticator> {
  const client = await createSupabaseServerClient();

  return {
    async signInWithPassword(alias, passcode) {
      const { data, error } = await client.auth.signInWithPassword({
        email: alias,
        password: passcode,
      });
      return !error && Boolean(data.session);
    },
  };
}
