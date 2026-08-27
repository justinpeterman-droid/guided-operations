import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/server/auth/current-session", () => ({
  authorizeCurrentSession: vi.fn(),
}));

import { authorizeCurrentSession } from "@/server/auth/current-session";

import {
  approveRetentionDeletion,
  executeRetentionDeletion,
  listRetentionDeletionRequestsForCurrentSession,
  type RetentionArtifactCleanup,
  type RetentionDeletionStore,
} from "./retention-deletion";

const actorId = "11111111-1111-4111-8111-111111111111";
const recordId = "22222222-2222-4222-8222-222222222222";
const requestId = "33333333-3333-4333-8333-333333333333";

function authorization(actorAuthUserId: string | null = actorId) {
  return {
    consume: vi
      .fn()
      .mockResolvedValue(actorAuthUserId ? { actorAuthUserId } : null),
  };
}

function store(): RetentionDeletionStore {
  return {
    approve: vi.fn().mockResolvedValue(requestId),
    execute: vi.fn().mockResolvedValue({
      databaseRowsDeleted: 6,
      artifactsDeleted: 1,
    }),
    list: vi.fn().mockResolvedValue([
      {
        requestId,
        recordType: "incident",
        recordId,
        authorityReference: "FICTIONAL-AUTHORITY-001",
        databaseBackupReference: "FICTIONAL-DB-BACKUP-001",
        storageBackupReference: "FICTIONAL-STORAGE-BACKUP-001",
        backupVerifiedAt: "2026-08-27T03:00:00.000Z",
        backupExpiresAt: "2026-08-29T03:00:00.000Z",
        artifactCount: 1,
        artifactsDeletedCount: 0,
        status: "approved",
        approvedAt: "2026-08-27T04:00:00.000Z",
        approvalExpiresAt: "2026-08-28T04:00:00.000Z",
        completedAt: null,
        databaseRowsDeleted: null,
      },
    ]),
  };
}

const cleanup: RetentionArtifactCleanup = {
  removeAndVerify: vi.fn().mockResolvedValue(undefined),
};

const approvalInput = {
  recordType: "incident",
  recordId,
  authorityReference: "FICTIONAL-AUTHORITY-001",
  databaseBackupReference: "FICTIONAL-DB-BACKUP-001",
  storageBackupReference: "FICTIONAL-STORAGE-BACKUP-001",
  backupManifestSha256: "a".repeat(64),
  backupVerifiedAt: "2026-08-27T03:00:00.000Z",
  backupExpiresAt: "2026-08-29T03:00:00.000Z",
} as const;

describe("controlled retention deletion", () => {
  beforeEach(() => vi.clearAllMocks());

  it("records a validated approval only after its purpose-bound step-up", async () => {
    const deletionStore = store();
    const result = await approveRetentionDeletion(approvalInput, {
      authorization: authorization(),
      store: deletionStore,
    });

    expect(result).toEqual({ status: "approved", requestId });
    expect(deletionStore.approve).toHaveBeenCalledWith(actorId, approvalInput);
  });

  it("rejects malformed backup evidence before consuming step-up", async () => {
    const approval = authorization();
    const deletionStore = store();
    const result = await approveRetentionDeletion(
      { ...approvalInput, backupManifestSha256: "not-a-digest" },
      { authorization: approval, store: deletionStore },
    );

    expect(result).toEqual({ status: "invalid_input" });
    expect(approval.consume).not.toHaveBeenCalled();
    expect(deletionStore.approve).not.toHaveBeenCalled();
  });

  it("does not allow a report-only deletion request", async () => {
    const approval = authorization();
    const deletionStore = store();
    const result = await approveRetentionDeletion(
      { ...approvalInput, recordType: "report" },
      { authorization: approval, store: deletionStore },
    );

    expect(result).toEqual({ status: "invalid_input" });
    expect(approval.consume).not.toHaveBeenCalled();
  });

  it("fails closed when the approval proof cannot be consumed", async () => {
    const deletionStore = store();
    const result = await approveRetentionDeletion(approvalInput, {
      authorization: authorization(null),
      store: deletionStore,
    });

    expect(result).toEqual({ status: "denied" });
    expect(deletionStore.approve).not.toHaveBeenCalled();
  });

  it("executes through the transactional store after a separate step-up", async () => {
    const deletionStore = store();
    const result = await executeRetentionDeletion(
      { requestId, confirmRecordId: recordId },
      {
        authorization: authorization(),
        store: deletionStore,
        cleanup,
      },
    );

    expect(result).toEqual({
      status: "completed",
      databaseRowsDeleted: 6,
      artifactsDeleted: 1,
    });
    expect(deletionStore.execute).toHaveBeenCalledWith(
      actorId,
      requestId,
      recordId,
      cleanup,
    );
  });

  it("does not start execution with a malformed request ID", async () => {
    const approval = authorization();
    const deletionStore = store();
    const result = await executeRetentionDeletion(
      { requestId: "invalid", confirmRecordId: recordId },
      {
        authorization: approval,
        store: deletionStore,
        cleanup,
      },
    );

    expect(result).toEqual({ status: "invalid_input" });
    expect(approval.consume).not.toHaveBeenCalled();
    expect(deletionStore.execute).not.toHaveBeenCalled();
  });

  it("returns a generic failure when Storage or database cleanup fails", async () => {
    const deletionStore = store();
    vi.mocked(deletionStore.execute).mockRejectedValueOnce(
      new Error("fictional provider failure"),
    );
    const result = await executeRetentionDeletion(
      { requestId, confirmRecordId: recordId },
      {
        authorization: authorization(),
        store: deletionStore,
        cleanup,
      },
    );

    expect(result).toEqual({ status: "failed" });
  });

  it("lists bounded deletion evidence only for a current administrator", async () => {
    vi.mocked(authorizeCurrentSession).mockResolvedValue({
      allowed: true,
      account: { authUserId: actorId },
    } as never);
    const deletionStore = store();

    const result = await listRetentionDeletionRequestsForCurrentSession(
      {} as never,
      deletionStore,
      { includeCompleted: true, limit: 100 },
    );

    expect(result.kind).toBe("listed");
    expect(deletionStore.list).toHaveBeenCalledWith(actorId, {
      includeCompleted: true,
      limit: 100,
    });
  });

  it("does not query deletion evidence for a non-administrator", async () => {
    vi.mocked(authorizeCurrentSession).mockResolvedValue({
      allowed: false,
      reason: "wrong_role",
    } as never);
    const deletionStore = store();

    const result = await listRetentionDeletionRequestsForCurrentSession(
      {} as never,
      deletionStore,
      { includeCompleted: true, limit: 100 },
    );

    expect(result).toEqual({ kind: "denied" });
    expect(deletionStore.list).not.toHaveBeenCalled();
  });
});
