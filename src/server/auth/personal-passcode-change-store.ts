import "server-only";

import postgres from "postgres";

import { getAuthServerEnvironment } from "@/lib/env/auth-server";

export type PersonalPasscodeChangeStore = Readonly<{
  verifyIdentity(
    authUserId: string,
    employeeLookupDigest: string,
  ): Promise<boolean>;
  prepare(authUserId: string, employeeLookupDigest: string): Promise<void>;
  record(authUserId: string, employeeLookupDigest: string): Promise<void>;
}>;

type Persistence = PersonalPasscodeChangeStore;

let personalPasscodeSql: ReturnType<typeof postgres> | undefined;

function getSql() {
  if (personalPasscodeSql) return personalPasscodeSql;
  personalPasscodeSql = postgres(getAuthServerEnvironment().SUPABASE_DB_URL, {
    max: 1,
    prepare: false,
    idle_timeout: 5,
  });
  return personalPasscodeSql;
}

function createPostgresPersistence(): Persistence {
  const sql = getSql();
  return {
    async verifyIdentity(authUserId, employeeLookupDigest) {
      const rows = await sql<ReadonlyArray<{ accepted: boolean }>>`
        select app_private.verify_personal_passcode_identity(
          ${authUserId}::uuid,
          ${employeeLookupDigest}
        ) as accepted
      `;
      return rows.at(0)?.accepted === true;
    },
    async prepare(authUserId, employeeLookupDigest) {
      await sql`
        select app_private.prepare_personal_passcode_change(
          ${authUserId}::uuid,
          ${employeeLookupDigest}
        )
      `;
    },
    async record(authUserId, employeeLookupDigest) {
      await sql`
        select app_private.record_personal_passcode_change(
          ${authUserId}::uuid,
          ${employeeLookupDigest}
        )
      `;
    },
  };
}

/** Server-only access to personal passcode identity and audit transactions. */
export function createPersonalPasscodeChangeStore(
  persistence: Persistence = createPostgresPersistence(),
): PersonalPasscodeChangeStore {
  return persistence;
}
