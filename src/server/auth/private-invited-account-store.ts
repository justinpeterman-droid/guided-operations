import "server-only";

import postgres from "postgres";

import { getAuthServerEnvironment } from "@/lib/env/auth-server";

import type { InvitedAccountStore } from "./invite-account";
import type { AccountDisableStore } from "./disable-account";
import type { AccountUnlockStore } from "./unlock-account";
import type { AccountPasscodeResetStore } from "./reset-account-passcode";

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

/** Server-only adapter for the separately audited account-disablement routine. */
export function createAccountDisableStore(): AccountDisableStore {
  const client = sql();
  return {
    async disable(actorAuthUserId, targetAuthUserId) {
      await client`select app_private.disable_account(${actorAuthUserId}::uuid, ${targetAuthUserId}::uuid)`;
    },
  };
}

/** Server-only adapter for the separately audited account-unlock routine. */
export function createAccountUnlockStore(): AccountUnlockStore {
  const client = sql();
  return {
    async unlock(actorAuthUserId, targetAuthUserId) {
      await client`select app_private.unlock_account(${actorAuthUserId}::uuid, ${targetAuthUserId}::uuid)`;
    },
  };
}

/** Server-only adapter for the separately audited passcode-reset preparation. */
export function createAccountPasscodeResetStore(): AccountPasscodeResetStore {
  const client = sql();
  return {
    async prepare(
      actorAuthUserId,
      targetAuthUserId,
      temporaryPasscodeExpiresAt,
    ) {
      await client`select app_private.prepare_account_passcode_reset(${actorAuthUserId}::uuid, ${targetAuthUserId}::uuid, ${temporaryPasscodeExpiresAt})`;
    },
  };
}
