import "server-only";

import { createHash } from "node:crypto";

import postgres from "postgres";
import { z } from "zod";

import { getAuthServerEnvironment } from "@/lib/env/auth-server";

import {
  retentionArtifactSchema,
  type RetentionArtifact,
  type RetentionDeletionStore,
} from "./retention-deletion";

const artifactRowSchema = z
  .object({
    artifact_id: z.string().uuid(),
    storage_bucket: z.literal("generated-exports"),
    storage_path: z.string().min(1).max(1024),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    byte_size: z.coerce.number().int().min(1).max(52_428_800),
  })
  .strict();

const requestManifestSchema = z
  .object({ artifact_manifest_sha256: z.string().regex(/^[a-f0-9]{64}$/) })
  .strict();

const requestRowSchema = z
  .object({
    request_id: z.string().uuid(),
    record_type: z.enum(["incident", "paperwork_record"]),
    record_id: z.string().uuid(),
    authority_reference: z.string(),
    database_backup_reference: z.string(),
    storage_backup_reference: z.string(),
    backup_verified_at: z.coerce.date(),
    backup_expires_at: z.coerce.date(),
    artifact_count: z.number().int(),
    artifacts_deleted_count: z.number().int(),
    status: z.enum(["approved", "executing", "completed", "canceled"]),
    approved_at: z.coerce.date(),
    approval_expires_at: z.coerce.date(),
    completed_at: z.coerce.date().nullable(),
    database_rows_deleted: z.number().int().nullable(),
  })
  .strict();

let retentionDeletionSql: ReturnType<typeof postgres> | undefined;

function sql(): ReturnType<typeof postgres> {
  if (retentionDeletionSql) return retentionDeletionSql;
  retentionDeletionSql = postgres(getAuthServerEnvironment().SUPABASE_DB_URL, {
    max: 1,
    prepare: false,
    idle_timeout: 5,
  });
  return retentionDeletionSql;
}

function toArtifact(row: z.infer<typeof artifactRowSchema>): RetentionArtifact {
  return retentionArtifactSchema.parse({
    artifactId: row.artifact_id,
    storageBucket: row.storage_bucket,
    storagePath: row.storage_path,
    sha256: row.sha256,
    byteSize: row.byte_size,
  });
}

function manifestSha256(artifacts: readonly RetentionArtifact[]): string {
  const body = [...artifacts]
    .sort((left, right) => left.artifactId.localeCompare(right.artifactId))
    .map(
      (artifact) =>
        `${artifact.artifactId}:${artifact.storageBucket}:${artifact.storagePath}:${artifact.sha256}:${artifact.byteSize}`,
    )
    .join("\n");
  return createHash("sha256").update(body).digest("hex");
}

/** Server-only adapter over the private retention deletion transaction. */
export function createRetentionDeletionStore(): RetentionDeletionStore {
  const client = sql();
  return {
    async approve(actorAuthUserId, input) {
      const rows = await client<ReadonlyArray<{ request_id: string }>>`
        select app_private.approve_retention_deletion(
          ${actorAuthUserId}::uuid,
          ${input.recordType},
          ${input.recordId}::uuid,
          ${input.authorityReference},
          ${input.databaseBackupReference},
          ${input.storageBackupReference},
          ${input.backupManifestSha256},
          ${input.backupVerifiedAt}::timestamptz,
          ${input.backupExpiresAt}::timestamptz
        ) as request_id
      `;
      const requestId = rows.at(0)?.request_id;
      if (!requestId) throw new Error("Deletion approval returned no ID.");
      return requestId;
    },
    async execute(actorAuthUserId, requestId, confirmRecordId, cleanup) {
      return client.begin(async (transaction) => {
        await transaction`
          select app_private.begin_retention_deletion(
            ${actorAuthUserId}::uuid,
            ${requestId}::uuid,
            ${confirmRecordId}::uuid
          )
        `;

        const rows = await transaction`
          select * from app_private.list_retention_deletion_artifacts(
            ${actorAuthUserId}::uuid,
            ${requestId}::uuid
          )
        `;
        const artifacts = z
          .array(artifactRowSchema)
          .parse(rows)
          .map(toArtifact);
        const requestRows = await transaction`
          select artifact_manifest_sha256
          from app_private.retention_deletion_requests
          where id = ${requestId}::uuid
        `;
        const expectedManifest = z
          .array(requestManifestSchema)
          .length(1)
          .parse(requestRows)[0].artifact_manifest_sha256;
        const observedManifest = manifestSha256(artifacts);
        if (observedManifest !== expectedManifest)
          throw new Error("Deletion artifact manifest changed.");

        await cleanup.removeAndVerify(artifacts);
        for (const artifact of artifacts) {
          await transaction`
            select app_private.mark_retention_artifact_deleted(
              ${actorAuthUserId}::uuid,
              ${requestId}::uuid,
              ${artifact.artifactId}::uuid
            )
          `;
        }
        await transaction`
          select app_private.verify_retention_artifact_cleanup(
            ${actorAuthUserId}::uuid,
            ${requestId}::uuid,
            ${observedManifest},
            0
          )
        `;
        const completed = await transaction<
          ReadonlyArray<{ database_rows_deleted: number }>
        >`
          select app_private.complete_retention_deletion(
            ${actorAuthUserId}::uuid,
            ${requestId}::uuid
          ) as database_rows_deleted
        `;
        const databaseRowsDeleted = z
          .number()
          .int()
          .min(1)
          .parse(completed.at(0)?.database_rows_deleted);
        return {
          databaseRowsDeleted,
          artifactsDeleted: artifacts.length,
        };
      });
    },
    async list(actorAuthUserId, options) {
      const rows = await client`
        select * from app_private.list_retention_deletion_requests(
          ${actorAuthUserId}::uuid,
          ${options.includeCompleted},
          ${options.limit}
        )
      `;
      return z
        .array(requestRowSchema)
        .parse(rows)
        .map((row) => ({
          requestId: row.request_id,
          recordType: row.record_type,
          recordId: row.record_id,
          authorityReference: row.authority_reference,
          databaseBackupReference: row.database_backup_reference,
          storageBackupReference: row.storage_backup_reference,
          backupVerifiedAt: row.backup_verified_at.toISOString(),
          backupExpiresAt: row.backup_expires_at.toISOString(),
          artifactCount: row.artifact_count,
          artifactsDeletedCount: row.artifacts_deleted_count,
          status: row.status,
          approvedAt: row.approved_at.toISOString(),
          approvalExpiresAt: row.approval_expires_at.toISOString(),
          completedAt: row.completed_at?.toISOString() ?? null,
          databaseRowsDeleted: row.database_rows_deleted,
        }));
    },
  };
}

export const retentionDeletionStoreInternals = { manifestSha256 };
