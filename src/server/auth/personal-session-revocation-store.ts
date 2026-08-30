import "server-only";

import postgres from "postgres";

import { getAuthServerEnvironment } from "@/lib/env/auth-server";

export type PersonalSessionRevocationStore = Readonly<{
  beginAll(authUserId: string, expectedAuthVersion: number): Promise<number>;
  completeAll(authUserId: string, expectedAuthVersion: number): Promise<number>;
}>;

let personalSessionRevocationSql: ReturnType<typeof postgres> | undefined;

function getSql() {
  if (personalSessionRevocationSql) return personalSessionRevocationSql;
  personalSessionRevocationSql = postgres(
    getAuthServerEnvironment().SUPABASE_DB_URL,
    { max: 1, prepare: false, idle_timeout: 5 },
  );
  return personalSessionRevocationSql;
}

function createPostgresPersistence(): PersonalSessionRevocationStore {
  const sql = getSql();
  async function advance(
    authUserId: string,
    expectedAuthVersion: number,
    outcome: "requested" | "completed",
  ): Promise<number> {
    const rows = await sql<ReadonlyArray<{ auth_version: number }>>`
      select app_private.revoke_personal_sessions(
        ${authUserId}::uuid,
        ${expectedAuthVersion}::integer,
        ${outcome}::text
      ) as auth_version
    `;
    const nextAuthVersion = rows.at(0)?.auth_version;
    if (
      typeof nextAuthVersion !== "number" ||
      !Number.isInteger(nextAuthVersion) ||
      nextAuthVersion < 1
    ) {
      throw new Error("Session revocation did not return valid authority.");
    }
    return nextAuthVersion;
  }

  return {
    beginAll: (authUserId, expectedAuthVersion) =>
      advance(authUserId, expectedAuthVersion, "requested"),
    completeAll: (authUserId, expectedAuthVersion) =>
      advance(authUserId, expectedAuthVersion, "completed"),
  };
}

/** Server-only access to the authoritative account-wide revocation transaction. */
export function createPersonalSessionRevocationStore(
  persistence: PersonalSessionRevocationStore = createPostgresPersistence(),
): PersonalSessionRevocationStore {
  return persistence;
}
