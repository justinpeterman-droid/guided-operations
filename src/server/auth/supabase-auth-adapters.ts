import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getAuthServerEnvironment } from "@/lib/env/auth-server";
import { getPublicSupabaseEnvironment } from "@/lib/env/supabase-public";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import type { PasswordAuthenticator } from "./employee-sign-in";
import type { AuthUserProvisioner } from "./first-admin-bootstrap";

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
      return !error && data.session && data.user?.id
        ? { authUserId: data.user.id }
        : null;
    },
  };
}

/**
 * Isolated Auth-admin adapter for protected lifecycle ceremonies only. It is
 * never constructed by browser routes or routine authenticated requests.
 */
export function createSupabaseAuthUserProvisioner(): AuthUserProvisioner {
  const client = createSupabaseAuthAdminClient();

  return {
    async createPasswordUser({ alias, passcode }) {
      const { data, error } = await client.auth.admin.createUser({
        email: alias,
        password: passcode,
        // The alias is synthetic and non-deliverable. The private bootstrap
        // ceremony owns credential delivery, not hosted Auth email.
        email_confirm: true,
      });
      return !error && data.user?.id ? { authUserId: data.user.id } : null;
    },
    async deleteUser(authUserId) {
      const { error } = await client.auth.admin.deleteUser(authUserId);
      if (error) throw new Error("Unable to remove pending Auth user.");
    },
  };
}
