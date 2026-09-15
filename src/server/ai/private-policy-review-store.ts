import "server-only";

import postgres from "postgres";
import { getAuthServerEnvironment } from "@/lib/env/auth-server";
import type { AuthorizedCurrentSession } from "@/server/auth/current-session";
import {
  policyReviewSnapshotSchema,
  type PolicyReview,
} from "./policy-review-contract";

let connection: ReturnType<typeof postgres> | undefined;

export function policyReviewTls(databaseUrl: string, ca: string | undefined) {
  const url = new URL(databaseUrl);
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    ![null, "verify-full"].includes(url.searchParams.get("sslmode")) ||
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
    !ca?.includes("-----BEGIN CERTIFICATE-----")
  ) {
    throw new Error("Policy review database trust is unavailable");
  }
  return { rejectUnauthorized: true as const, ca };
}

export function createPolicyReviewStore() {
  if (!connection) {
    const url = getAuthServerEnvironment().SUPABASE_DB_URL;
    connection = postgres(url, {
      max: 1,
      prepare: false,
      idle_timeout: 5,
      connect_timeout: 10,
      ssl: policyReviewTls(url, process.env.SUPABASE_DB_CA),
      connection: { statement_timeout: 15000, lock_timeout: 5000 },
    });
  }
  const sql = connection;
  return {
    async snapshot(
      session: AuthorizedCurrentSession,
      versionId: string,
      runId: string,
    ) {
      const [row] = await sql`
        select app_private.policy_review_snapshot(
          ${session.account.authUserId}::uuid, ${session.sessionId}::uuid,
          ${session.account.authVersion}, ${versionId}::uuid, ${runId}::uuid
        ) as snapshot
      `;
      return policyReviewSnapshotSchema.parse(row?.snapshot);
    },
    async approve(
      session: AuthorizedCurrentSession,
      review: PolicyReview,
      requestId: string,
      tokenDigest: string,
    ) {
      const [row] = await sql`
        select app_private.approve_policy_review(
          ${session.account.authUserId}::uuid, ${session.sessionId}::uuid,
          ${session.account.authVersion}, ${sql.json(review)}, ${requestId}::uuid, ${tokenDigest}
        ) as status
      `;
      if (!["approved_for_embedding", "already_approved"].includes(row?.status))
        throw new Error("Policy review did not complete");
      return row.status as "approved_for_embedding" | "already_approved";
    },
  };
}
