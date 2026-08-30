import "server-only";

import postgres from "postgres";

import { getAuthServerEnvironment } from "@/lib/env/auth-server";

import type { AdminStepUpPurpose } from "./admin-step-up";

export type AdminStepUpStore = Readonly<{
  issue(
    input: Readonly<{
      authUserId: string;
      sessionId: string;
      authVersion: number;
      purpose: AdminStepUpPurpose;
      tokenDigest: string;
      requestId: string;
      expiresAt: Date;
    }>,
  ): Promise<void>;
  consume(
    input: Readonly<{
      authUserId: string;
      sessionId: string;
      authVersion: number;
      purpose: AdminStepUpPurpose;
      tokenDigest: string;
      requestId: string;
    }>,
  ): Promise<boolean>;
}>;

type Persistence = AdminStepUpStore;

let privateAdminStepUpSql: ReturnType<typeof postgres> | undefined;

function getPrivateAdminStepUpSql(): ReturnType<typeof postgres> {
  if (privateAdminStepUpSql) return privateAdminStepUpSql;

  const environment = getAuthServerEnvironment();
  privateAdminStepUpSql = postgres(environment.SUPABASE_DB_URL, {
    max: 1,
    prepare: false,
    idle_timeout: 5,
  });
  return privateAdminStepUpSql;
}

function createPostgresPersistence(): Persistence {
  const sql = getPrivateAdminStepUpSql();

  return {
    async issue(input) {
      await sql`
        select app_private.issue_admin_step_up(
          ${input.authUserId}::uuid,
          ${input.sessionId}::uuid,
          ${input.authVersion},
          ${input.purpose},
          ${input.tokenDigest},
          ${input.requestId}::uuid,
          ${input.expiresAt}
        )
      `;
    },
    async consume(input) {
      const rows = await sql<ReadonlyArray<{ consumed: boolean }>>`
        select app_private.consume_admin_step_up(
          ${input.authUserId}::uuid,
          ${input.sessionId}::uuid,
          ${input.authVersion},
          ${input.purpose},
          ${input.tokenDigest},
          ${input.requestId}::uuid
        ) as consumed
      `;
      return rows.at(0)?.consumed === true;
    },
  };
}

/** Server-only facade over the private, one-time step-up database routines. */
export function createAdminStepUpStore(
  persistence: Persistence = createPostgresPersistence(),
): AdminStepUpStore {
  return {
    issue: (input) => persistence.issue(input),
    consume: (input) => persistence.consume(input),
  };
}
