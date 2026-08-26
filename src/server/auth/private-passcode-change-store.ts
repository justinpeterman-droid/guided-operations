import "server-only";

import postgres from "postgres";

import { getAuthServerEnvironment } from "@/lib/env/auth-server";

export type TemporaryPasscodeChangeStore = Readonly<{
  complete(
    input: Readonly<{ authUserId: string; employeeLookupDigest: string }>,
  ): Promise<void>;
}>;

type Persistence = Readonly<{
  complete(
    input: Readonly<{ authUserId: string; employeeLookupDigest: string }>,
  ): Promise<void>;
}>;

let privatePasscodeChangeSql: ReturnType<typeof postgres> | undefined;

function getPrivatePasscodeChangeSql(): ReturnType<typeof postgres> {
  if (privatePasscodeChangeSql) return privatePasscodeChangeSql;

  const environment = getAuthServerEnvironment();
  privatePasscodeChangeSql = postgres(environment.SUPABASE_DB_URL, {
    max: 1,
    prepare: false,
    idle_timeout: 5,
  });
  return privatePasscodeChangeSql;
}

function createPostgresPersistence(): Persistence {
  const sql = getPrivatePasscodeChangeSql();
  return {
    async complete(input) {
      await sql`
        select app_private.complete_temporary_passcode_change(
          ${input.authUserId}::uuid,
          ${input.employeeLookupDigest}
        )
      `;
    },
  };
}

/** Server-only access to the private forced-passcode completion transaction. */
export function createTemporaryPasscodeChangeStore(
  persistence: Persistence = createPostgresPersistence(),
): TemporaryPasscodeChangeStore {
  return { complete: (input) => persistence.complete(input) };
}
