import "server-only";

import postgres from "postgres";

import { getAuthServerEnvironment } from "@/lib/env/auth-server";

import type { FirstAdminBootstrapStore } from "./first-admin-bootstrap";

type BootstrapPersistence = Readonly<{
  stage(input: Parameters<FirstAdminBootstrapStore["stage"]>[0]): Promise<void>;
  activate(authUserId: string): Promise<void>;
  abandon(authUserId: string): Promise<void>;
}>;

let privateBootstrapSql: ReturnType<typeof postgres> | undefined;

function getPrivateBootstrapSql(): ReturnType<typeof postgres> {
  if (privateBootstrapSql) return privateBootstrapSql;

  const environment = getAuthServerEnvironment();
  privateBootstrapSql = postgres(environment.SUPABASE_DB_URL, {
    max: 1,
    prepare: false,
    idle_timeout: 5,
  });
  return privateBootstrapSql;
}

function createPostgresBootstrapPersistence(): BootstrapPersistence {
  const sql = getPrivateBootstrapSql();

  return {
    async stage(input) {
      await sql`
        select app_private.bootstrap_first_administrator(
          ${input.authUserId}::uuid,
          ${input.employeeLookupDigest},
          ${input.employeeNumberHint},
          ${input.displayName},
          ${input.signInAlias},
          ${input.temporaryPasscodeExpiresAt}
        )
      `;
    },
    async activate(authUserId) {
      await sql`
        select app_private.activate_bootstrapped_administrator(${authUserId}::uuid)
      `;
    },
    async abandon(authUserId) {
      await sql`
        select app_private.abandon_bootstrapped_administrator(${authUserId}::uuid)
      `;
    },
  };
}

/**
 * Server-only facade over the non-exposed bootstrap functions. The backing
 * functions own the transaction lock, account state, and allowlisted audit.
 */
export function createFirstAdminBootstrapStore(
  persistence: BootstrapPersistence = createPostgresBootstrapPersistence(),
): FirstAdminBootstrapStore {
  return {
    stage(input) {
      return persistence.stage(input);
    },
    activate(authUserId) {
      return persistence.activate(authUserId);
    },
    abandon(authUserId) {
      return persistence.abandon(authUserId);
    },
  };
}
