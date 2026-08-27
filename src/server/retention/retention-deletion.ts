import "server-only";

import { z } from "zod";

import type { AdminActionAuthorization } from "@/server/auth/authorize-admin-action";
import {
  authorizeCurrentSession,
  type CurrentSessionClient,
} from "@/server/auth/current-session";

export const RETENTION_DELETION_RECORD_TYPES = [
  "incident",
  "paperwork_record",
] as const;

const evidenceReferenceSchema = z
  .string()
  .min(3)
  .max(160)
  .regex(/^[A-Za-z0-9][A-Za-z0-9 ._:/-]*$/);

const approvalInputSchema = z
  .object({
    recordType: z.enum(RETENTION_DELETION_RECORD_TYPES),
    recordId: z.string().uuid(),
    authorityReference: evidenceReferenceSchema,
    databaseBackupReference: evidenceReferenceSchema,
    storageBackupReference: evidenceReferenceSchema,
    backupManifestSha256: z.string().regex(/^[a-f0-9]{64}$/),
    backupVerifiedAt: z.iso.datetime({ offset: true }),
    backupExpiresAt: z.iso.datetime({ offset: true }),
  })
  .strict();

const executionInputSchema = z
  .object({
    requestId: z.string().uuid(),
    confirmRecordId: z.string().uuid(),
  })
  .strict();

export const retentionArtifactSchema = z
  .object({
    artifactId: z.string().uuid(),
    storageBucket: z.literal("generated-exports"),
    storagePath: z.string().min(1).max(1024),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    byteSize: z.number().int().min(1).max(52_428_800),
  })
  .strict();

export type RetentionArtifact = z.infer<typeof retentionArtifactSchema>;

const deletionRequestSummarySchema = z
  .object({
    requestId: z.string().uuid(),
    recordType: z.enum(RETENTION_DELETION_RECORD_TYPES),
    recordId: z.string().uuid(),
    authorityReference: evidenceReferenceSchema,
    databaseBackupReference: evidenceReferenceSchema,
    storageBackupReference: evidenceReferenceSchema,
    backupVerifiedAt: z.iso.datetime({ offset: true }),
    backupExpiresAt: z.iso.datetime({ offset: true }),
    artifactCount: z.number().int().min(0).max(10_000),
    artifactsDeletedCount: z.number().int().min(0).max(10_000),
    status: z.enum(["approved", "executing", "completed", "canceled"]),
    approvedAt: z.iso.datetime({ offset: true }),
    approvalExpiresAt: z.iso.datetime({ offset: true }),
    completedAt: z.iso.datetime({ offset: true }).nullable(),
    databaseRowsDeleted: z.number().int().min(0).nullable(),
  })
  .strict();

export type RetentionDeletionRequestSummary = z.infer<
  typeof deletionRequestSummarySchema
>;

export type RetentionArtifactCleanup = Readonly<{
  removeAndVerify(artifacts: readonly RetentionArtifact[]): Promise<void>;
}>;

export type RetentionDeletionStore = Readonly<{
  approve(
    actorAuthUserId: string,
    input: z.infer<typeof approvalInputSchema>,
  ): Promise<string>;
  execute(
    actorAuthUserId: string,
    requestId: string,
    confirmRecordId: string,
    cleanup: RetentionArtifactCleanup,
  ): Promise<
    Readonly<{ databaseRowsDeleted: number; artifactsDeleted: number }>
  >;
  list(
    actorAuthUserId: string,
    options: Readonly<{ includeCompleted: boolean; limit: number }>,
  ): Promise<unknown>;
}>;

export type RetentionDeletionApprovalResult =
  | Readonly<{ status: "approved"; requestId: string }>
  | Readonly<{ status: "invalid_input" | "denied" | "failed" }>;

export type RetentionDeletionExecutionResult =
  | Readonly<{
      status: "completed";
      databaseRowsDeleted: number;
      artifactsDeleted: number;
    }>
  | Readonly<{ status: "invalid_input" | "denied" | "failed" }>;

export type ListRetentionDeletionRequestsResult =
  | Readonly<{
      kind: "listed";
      requests: readonly RetentionDeletionRequestSummary[];
    }>
  | Readonly<{ kind: "denied" }>
  | Readonly<{ kind: "unavailable" }>;

/** Returns only bounded deletion metadata after a current administrator check. */
export async function listRetentionDeletionRequestsForCurrentSession(
  client: CurrentSessionClient,
  store: RetentionDeletionStore,
  options: Readonly<{ includeCompleted: boolean; limit: number }>,
): Promise<ListRetentionDeletionRequestsResult> {
  const session = await authorizeCurrentSession(client, {
    requiredRole: "administrator",
  });
  if (!session.allowed) return { kind: "denied" };
  if (
    !Number.isInteger(options.limit) ||
    options.limit < 1 ||
    options.limit > 200
  )
    return { kind: "unavailable" };

  try {
    const parsed = z
      .array(deletionRequestSummarySchema)
      .safeParse(await store.list(session.account.authUserId, options));
    return parsed.success
      ? { kind: "listed", requests: parsed.data }
      : { kind: "unavailable" };
  } catch {
    return { kind: "unavailable" };
  }
}

/** Records a metadata-only approval after consuming its dedicated step-up. */
export async function approveRetentionDeletion(
  input: unknown,
  dependencies: Readonly<{
    authorization: AdminActionAuthorization;
    store: RetentionDeletionStore;
  }>,
): Promise<RetentionDeletionApprovalResult> {
  const parsed = approvalInputSchema.safeParse(input);
  if (!parsed.success) return { status: "invalid_input" };
  const authorization = await dependencies.authorization.consume();
  if (!authorization) return { status: "denied" };

  try {
    const requestId = await dependencies.store.approve(
      authorization.actorAuthUserId,
      parsed.data,
    );
    return z.string().uuid().safeParse(requestId).success
      ? { status: "approved", requestId }
      : { status: "failed" };
  } catch {
    return { status: "failed" };
  }
}

/**
 * Executes Storage and database cleanup through one store-owned transaction.
 * The database independently binds every step to that backend transaction.
 */
export async function executeRetentionDeletion(
  input: unknown,
  dependencies: Readonly<{
    authorization: AdminActionAuthorization;
    store: RetentionDeletionStore;
    cleanup: RetentionArtifactCleanup;
  }>,
): Promise<RetentionDeletionExecutionResult> {
  const parsed = executionInputSchema.safeParse(input);
  if (!parsed.success) return { status: "invalid_input" };
  const authorization = await dependencies.authorization.consume();
  if (!authorization) return { status: "denied" };

  try {
    const result = await dependencies.store.execute(
      authorization.actorAuthUserId,
      parsed.data.requestId,
      parsed.data.confirmRecordId,
      dependencies.cleanup,
    );
    if (
      !Number.isInteger(result.databaseRowsDeleted) ||
      result.databaseRowsDeleted < 1 ||
      !Number.isInteger(result.artifactsDeleted) ||
      result.artifactsDeleted < 0
    )
      return { status: "failed" };
    return { status: "completed", ...result };
  } catch {
    return { status: "failed" };
  }
}
