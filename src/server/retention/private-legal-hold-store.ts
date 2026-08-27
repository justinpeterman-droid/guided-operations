import "server-only";

import postgres from "postgres";
import { z } from "zod";

import { getAuthServerEnvironment } from "@/lib/env/auth-server";

import {
  LEGAL_HOLD_SCOPE_TYPES,
  RETENTION_REVIEW_RECORD_TYPES,
  type LegalHoldStore,
} from "./legal-hold";

const rowSchema = z
  .object({
    hold_id: z.string().uuid(),
    scope_type: z.enum(LEGAL_HOLD_SCOPE_TYPES),
    scope_id: z.string().uuid(),
    authority_reference: z.string(),
    created_at: z.coerce.date(),
    released_at: z.coerce.date().nullable(),
    release_authority_reference: z.string().nullable(),
  })
  .strict();

const retentionReviewRowSchema = z
  .object({
    record_type: z.enum(RETENTION_REVIEW_RECORD_TYPES),
    record_id: z.string().uuid(),
    archived_at: z.coerce.date(),
    deletion_eligible_at: z.coerce.date(),
    active_legal_hold: z.boolean(),
    deletion_ready: z.boolean(),
  })
  .strict();

let legalHoldSql: ReturnType<typeof postgres> | undefined;

function sql(): ReturnType<typeof postgres> {
  if (legalHoldSql) return legalHoldSql;
  legalHoldSql = postgres(getAuthServerEnvironment().SUPABASE_DB_URL, {
    max: 1,
    prepare: false,
    idle_timeout: 5,
  });
  return legalHoldSql;
}

/** Server-only adapter over private, non-Data-API legal-hold routines. */
export function createLegalHoldStore(): LegalHoldStore {
  const client = sql();
  return {
    async place(actorAuthUserId, input) {
      const rows = await client<ReadonlyArray<{ hold_id: string }>>`
        select app_private.place_legal_hold(
          ${actorAuthUserId}::uuid,
          ${input.scopeType},
          ${input.scopeId}::uuid,
          ${input.authorityReference}
        ) as hold_id
      `;
      const holdId = rows.at(0)?.hold_id;
      if (!holdId) throw new Error("Legal hold placement returned no ID.");
      return holdId;
    },
    async release(actorAuthUserId, holdId, authorityReference) {
      await client`
        select app_private.release_legal_hold(
          ${actorAuthUserId}::uuid,
          ${holdId}::uuid,
          ${authorityReference}
        )
      `;
    },
    async list(actorAuthUserId, options) {
      const rows = await client`
        select * from app_private.list_legal_holds(
          ${actorAuthUserId}::uuid,
          ${options.includeReleased},
          ${options.limit}
        )
      `;
      return z
        .array(rowSchema)
        .parse(rows)
        .map((row) => ({
          holdId: row.hold_id,
          scopeType: row.scope_type,
          scopeId: row.scope_id,
          authorityReference: row.authority_reference,
          createdAt: row.created_at.toISOString(),
          releasedAt: row.released_at?.toISOString() ?? null,
          releaseAuthorityReference: row.release_authority_reference,
        }));
    },
    async listRetentionReview(actorAuthUserId, options) {
      const rows = await client`
        select * from app_private.list_retention_review_candidates(
          ${actorAuthUserId}::uuid,
          ${options.asOf}::timestamptz,
          ${options.limit}
        )
      `;
      return z
        .array(retentionReviewRowSchema)
        .parse(rows)
        .map((row) => ({
          recordType: row.record_type,
          recordId: row.record_id,
          archivedAt: row.archived_at.toISOString(),
          deletionEligibleAt: row.deletion_eligible_at.toISOString(),
          activeLegalHold: row.active_legal_hold,
          deletionReady: row.deletion_ready,
        }));
    },
  };
}
