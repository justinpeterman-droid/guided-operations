import "server-only";

import postgres from "postgres";

import { getAuthServerEnvironment } from "@/lib/env/auth-server";

import type { AuthAliasLookup } from "./employee-sign-in";

type AliasRow = Readonly<{ sign_in_alias: string; auth_user_id: string }>;

let privateAuthSql: ReturnType<typeof postgres> | undefined;

function getPrivateAuthSql(): ReturnType<typeof postgres> {
  if (privateAuthSql) return privateAuthSql;

  const environment = getAuthServerEnvironment();
  privateAuthSql = postgres(environment.SUPABASE_DB_URL, {
    max: 1,
    prepare: false,
    idle_timeout: 5,
  });
  return privateAuthSql;
}

/**
 * Direct server-only database lookup. The private schema remains unavailable
 * through the Data API, and this adapter returns only the synthetic alias
 * required for the following Auth password exchange.
 */
export function createPrivateAuthAliasLookup(): AuthAliasLookup {
  const sql = getPrivateAuthSql();

  return {
    async findActiveAlias(employeeLookupDigest) {
      const rows = await sql<AliasRow[]>`
        select account.sign_in_alias, account.auth_user_id
        from app_private.staff_members as staff
        join app_private.user_accounts as account
          on account.staff_member_id = staff.id
        where staff.employee_lookup_hash = ${employeeLookupDigest}
          and staff.status = 'active'
          and account.status = 'active'
        limit 1
      `;

      const alias = rows.at(0)?.sign_in_alias;
      const authUserId = rows.at(0)?.auth_user_id;
      return alias && authUserId ? { alias, authUserId } : null;
    },
  };
}
