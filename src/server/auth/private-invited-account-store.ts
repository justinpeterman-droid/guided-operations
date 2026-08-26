import "server-only";

import postgres from "postgres";

import { getAuthServerEnvironment } from "@/lib/env/auth-server";

import type { InvitedAccountStore } from "./invite-account";

let sqlClient: ReturnType<typeof postgres> | undefined;

function sql() {
  if (sqlClient) return sqlClient;
  sqlClient = postgres(getAuthServerEnvironment().SUPABASE_DB_URL, {
    max: 1,
    prepare: false,
    idle_timeout: 5,
  });
  return sqlClient;
}

/** Private database adapter for the staged invite/activate/abandon ceremony. */
export function createInvitedAccountStore(): InvitedAccountStore {
  const client = sql();
  return {
    async stage(input) {
      await client`select app_private.stage_invited_account(${input.actorAuthUserId}::uuid,${input.authUserId}::uuid,${input.employeeLookupDigest},${input.employeeNumberHint},${input.displayName},${input.role}::app_private.account_role,${input.signInAlias},${input.temporaryPasscodeExpiresAt})`;
    },
    async activate(authUserId, actorAuthUserId) {
      await client`select app_private.activate_invited_account(${actorAuthUserId}::uuid,${authUserId}::uuid)`;
    },
    async abandon(authUserId, actorAuthUserId) {
      await client`select app_private.abandon_invited_account(${actorAuthUserId}::uuid,${authUserId}::uuid)`;
    },
  };
}
