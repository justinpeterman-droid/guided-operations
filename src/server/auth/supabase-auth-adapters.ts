import "server-only";

import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

import { getAuthServerEnvironment } from "@/lib/env/auth-server";
import { getAuthSessionEnvironment } from "@/lib/env/auth-session";
import { getRuntimeEnvironment } from "@/lib/env/runtime";
import { getPublicSupabaseEnvironment } from "@/lib/env/supabase-public";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseSessionClient } from "@/lib/supabase/session-client";
import {
  createEncryptedSupabaseSessionStorage,
  type SessionCookieIo,
} from "@/server/auth/encrypted-supabase-session-storage";

import type { PasswordAuthenticator } from "./employee-sign-in";
import type { AuthUserProvisioner } from "./first-admin-bootstrap";
import type { AdministratorPasscodeVerifier } from "./request-admin-step-up";
import type { AuthPasswordResetter } from "./reset-account-passcode";
import type { AccountPasscodeVerifier } from "./change-personal-passcode";

export type { PasswordAuthenticator } from "./employee-sign-in";

type ActiveAliasLookup = Readonly<{
  findActiveAlias(authUserId: string): Promise<string | null>;
}>;

let privateAliasLookupSql: ReturnType<typeof postgres> | undefined;

function createActiveAliasLookup(): ActiveAliasLookup {
  if (!privateAliasLookupSql) {
    privateAliasLookupSql = postgres(
      getAuthServerEnvironment().SUPABASE_DB_URL,
      {
        max: 1,
        prepare: false,
        idle_timeout: 5,
      },
    );
  }
  const sql = privateAliasLookupSql;

  return {
    async findActiveAlias(authUserId) {
      const rows = await sql<ReadonlyArray<{ sign_in_alias: string }>>`
        select sign_in_alias
        from app_private.user_accounts
        where auth_user_id = ${authUserId}::uuid
          and status = 'active'
        limit 1
      `;
      return rows.at(0)?.sign_in_alias ?? null;
    },
  };
}

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
  return createPasswordAuthenticator(client);
}

/**
 * Creates a password authenticator whose encrypted session mutations are owned
 * by the caller's response. Route handlers use this for native redirects.
 */
export function createSupabasePasswordAuthenticatorForCookieIo(
  cookies: SessionCookieIo,
): PasswordAuthenticator {
  const environment = getPublicSupabaseEnvironment();
  const authSessionEnvironment = getAuthSessionEnvironment();
  const runtimeEnvironment = getRuntimeEnvironment();
  const client = createSupabaseSessionClient(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    createEncryptedSupabaseSessionStorage({
      encryptionKey: authSessionEnvironment.AUTH_SESSION_ENCRYPTION_KEY,
      secure:
        runtimeEnvironment.APP_ENV !== "development" &&
        runtimeEnvironment.APP_ENV !== "test",
      cookies,
    }),
  );
  return createPasswordAuthenticator(client);
}

function createPasswordAuthenticator(
  client: Awaited<ReturnType<typeof createSupabaseServerClient>>,
): PasswordAuthenticator {
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

/** Isolated Auth-admin adapter for a private administrator-issued reset only. */
export function createSupabaseAuthPasswordResetter(): AuthPasswordResetter {
  const client = createSupabaseAuthAdminClient();
  return {
    async updatePassword(authUserId, passcode) {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const { error } = await client.auth.admin.updateUserById(authUserId, {
            password: passcode,
          });
          if (!error) return true;
          const status = "status" in error ? error.status : undefined;
          if (
            attempt > 0 ||
            typeof status !== "number" ||
            (status !== 429 && status < 500)
          )
            return false;
        } catch {
          if (attempt > 0) return false;
        }
      }
      return false;
    },
  };
}

/**
 * Rechecks an administrator's own passcode through an isolated, non-persistent
 * provider client. It never changes the browser's existing session and never
 * exposes the synthetic sign-in alias outside this server-only adapter.
 */
export function createSupabaseAdministratorPasscodeVerifier(
  aliasLookup: ActiveAliasLookup = createActiveAliasLookup(),
): AdministratorPasscodeVerifier {
  return createSupabaseAccountPasscodeVerifier(aliasLookup);
}

/** Rechecks any active account's current passcode without changing its session. */
export function createSupabaseAccountPasscodeVerifier(
  aliasLookup: ActiveAliasLookup = createActiveAliasLookup(),
): AccountPasscodeVerifier {
  const environment = getPublicSupabaseEnvironment();
  const client = createClient(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  return {
    async verify(authUserId, passcode) {
      try {
        const alias = await aliasLookup.findActiveAlias(authUserId);
        if (!alias) return false;

        const { data, error } = await client.auth.signInWithPassword({
          email: alias,
          password: passcode,
        });
        return !error && data.user?.id === authUserId;
      } catch {
        return false;
      }
    },
  };
}
