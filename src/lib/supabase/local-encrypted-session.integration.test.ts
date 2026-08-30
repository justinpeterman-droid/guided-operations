// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import postgres from "postgres";

import {
  createEncryptedSupabaseSessionStorage,
  SUPABASE_SESSION_STORAGE_KEY,
} from "@/server/auth/encrypted-supabase-session-storage";
import { loadCurrentAccountFromRpc } from "@/server/auth/current-account-rpc";
import { parseSessionAuthority } from "@/server/auth/session-claims";
import { createLocalQualificationOfficer } from "../../../tests/e2e/support/local-qualification-account";

import { createSupabaseSessionClient } from "./session-client";

const enabled = process.env.LOCAL_SESSION_INTEGRATION_ENABLED === "true";

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing local integration setting: ${name}`);
  return value;
}

describe.skipIf(!enabled)("local encrypted Supabase session", () => {
  it("signs in, verifies claims, carries RLS authority, and keeps the alias opaque", async () => {
    await createLocalQualificationOfficer();
    const sql = postgres(requiredEnvironment("SUPABASE_DB_URL"), {
      max: 1,
      prepare: false,
      idle_timeout: 5,
    });
    let alias: string;
    try {
      const rows = await sql<ReadonlyArray<{ sign_in_alias: string }>>`
        select sign_in_alias
        from app_private.user_accounts
        where role = 'officer'::app_private.account_role
        limit 1
      `;
      alias = rows[0]?.sign_in_alias ?? "";
    } finally {
      await sql.end({ timeout: 5 });
    }
    if (!alias) throw new Error("The fictional officer alias is unavailable.");

    let browserCookies: Array<{ name: string; value: string }> = [];
    const storage = createEncryptedSupabaseSessionStorage({
      encryptionKey: requiredEnvironment("AUTH_SESSION_ENCRYPTION_KEY"),
      secure: false,
      cookies: {
        readAll: () => browserCookies,
        writeAll: (changes) => {
          for (const change of changes) {
            browserCookies = browserCookies.filter(
              ({ name }) => name !== change.name,
            );
            if (change.options.maxAge !== 0) {
              browserCookies.push({
                name: change.name,
                value: change.value,
              });
            }
          }
        },
      },
    });
    const firstClient = createSupabaseSessionClient(
      requiredEnvironment("NEXT_PUBLIC_SUPABASE_URL"),
      requiredEnvironment("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
      storage,
    );
    const signIn = await firstClient.auth.signInWithPassword({
      email: alias,
      password: "FictionalLocalOfficerPasscode9!",
    });
    if (signIn.error || !signIn.data.session) {
      throw new Error("The fictional encrypted-session sign-in failed.");
    }

    const browserCookieText = browserCookies
      .map(({ name, value }) => `${name}=${value}`)
      .join("; ");
    expect(browserCookieText).not.toContain(alias);
    expect(browserCookieText).not.toContain(signIn.data.session.access_token);
    expect(browserCookieText).not.toContain(signIn.data.session.refresh_token);
    expect(browserCookieText).not.toMatch(/=eyJ[A-Za-z0-9_-]+\./);

    const requestClient = createSupabaseSessionClient(
      requiredEnvironment("NEXT_PUBLIC_SUPABASE_URL"),
      requiredEnvironment("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
      storage,
    );
    const claims = await requestClient.auth.getClaims();
    if (claims.error)
      throw new Error("The provider rejected the encrypted session claims.");
    if (!claims.data?.claims)
      throw new Error("The encrypted session had no verified claims.");
    const authority = parseSessionAuthority(claims.data.claims);
    if (!authority)
      throw new Error("The verified session lacked application authority.");
    const currentAccount = await loadCurrentAccountFromRpc(requestClient);
    if (!currentAccount) {
      throw new Error("The encrypted session did not carry RLS authority.");
    }
    expect(currentAccount.authUserId).toBe(authority.authUserId);
    expect(currentAccount.authVersion).toBe(authority.authVersion);
    expect(currentAccount.role).toBe("officer");
    expect(currentAccount.shiftCode).toBe("A");

    const cookiesBeforeRefresh = browserCookies
      .map(({ name, value }) => `${name}=${value}`)
      .sort();
    const refreshed = await requestClient.auth.refreshSession();
    if (refreshed.error || !refreshed.data.session) {
      throw new Error("The provider rejected encrypted session rotation.");
    }
    expect(refreshed.data.session.refresh_token).not.toBe(
      signIn.data.session.refresh_token,
    );
    expect(
      browserCookies.map(({ name, value }) => `${name}=${value}`).sort(),
    ).not.toEqual(cookiesBeforeRefresh);
    const storedSession = JSON.parse(
      (await storage.getItem(SUPABASE_SESSION_STORAGE_KEY)) ?? "null",
    ) as { refresh_token?: unknown } | null;
    expect(storedSession?.refresh_token).toBe(
      refreshed.data.session.refresh_token,
    );
  });
});
