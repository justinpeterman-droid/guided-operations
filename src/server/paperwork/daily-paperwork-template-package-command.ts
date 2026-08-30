import "server-only";

import { z } from "zod";

import type { AuthorizedCurrentSession } from "@/server/auth/current-session";

import {
  prepareDailyPaperworkImport,
  summarizeDailyPaperworkImport,
} from "./daily-paperwork-import-manifest";
import {
  verifyDailyPaperworkSourcePackage,
  type DailyPaperworkSourceFile,
} from "./daily-paperwork-source-package";
import type { DailyPaperworkTemplatePackageStore } from "./private-daily-paperwork-template-package-store";

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u);
const commonSchema = z
  .object({
    action: z.enum(["validate", "register"]),
    sourceAuthority: z.string().trim().min(1).max(160),
    sourceRevision: z.string().trim().min(1).max(160),
    activeFrom: z.iso.date(),
    expectedCurrentPackageDigest: sha256Schema.nullable(),
    rollbackOfPackageDigest: sha256Schema.nullable(),
  })
  .strict();
const proofSchema = z
  .object({
    token: z.string().min(32).max(256),
    requestId: z.uuid(),
    idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{16,128}$/u),
  })
  .strict();

export type DailyPaperworkTemplatePackageCommand = Readonly<{
  action: "validate" | "register";
  sourceAuthority: string;
  sourceRevision: string;
  activeFrom: string;
  expectedCurrentPackageDigest: string | null;
  rollbackOfPackageDigest: string | null;
  files: readonly DailyPaperworkSourceFile[];
  proof?: Readonly<{ token: string; requestId: string }>;
  idempotencyKey?: string;
}>;

/**
 * Validates and maps one complete package for a current administrator. Only the
 * register branch sends private mapped bodies to the atomic database routine.
 */
export async function runDailyPaperworkTemplatePackageCommand(
  candidate: DailyPaperworkTemplatePackageCommand,
  session: AuthorizedCurrentSession,
  dependencies: Readonly<{
    store: DailyPaperworkTemplatePackageStore;
    hmacKey: string;
  }>,
) {
  const common = commonSchema.safeParse({
    action: candidate.action,
    sourceAuthority: candidate.sourceAuthority,
    sourceRevision: candidate.sourceRevision,
    activeFrom: candidate.activeFrom,
    expectedCurrentPackageDigest: candidate.expectedCurrentPackageDigest,
    rollbackOfPackageDigest: candidate.rollbackOfPackageDigest,
  });
  if (!common.success) return { status: "invalid" as const };

  let prepared;
  try {
    prepared = prepareDailyPaperworkImport(
      verifyDailyPaperworkSourcePackage(candidate.files),
      {
        facilityId: session.account.facilityId,
        sourceAuthority: common.data.sourceAuthority,
        sourceRevision: common.data.sourceRevision,
        rightsStatus: "approved_internal_use",
        activeFrom: common.data.activeFrom,
        expectedCurrentPackageDigest: common.data.expectedCurrentPackageDigest,
        rollbackOfPackageDigest: common.data.rollbackOfPackageDigest,
      },
    );
  } catch {
    return { status: "invalid" as const };
  }

  const evidence = summarizeDailyPaperworkImport(prepared);
  if (common.data.action === "validate")
    return { status: "reviewed" as const, evidence };

  const proof = proofSchema.safeParse({
    token: candidate.proof?.token,
    requestId: candidate.proof?.requestId,
    idempotencyKey: candidate.idempotencyKey,
  });
  if (!proof.success) return { status: "invalid" as const };

  try {
    const packageId = await dependencies.store.register({
      actorAuthUserId: session.account.authUserId,
      sessionId: session.sessionId,
      authVersion: session.account.authVersion,
      stepUpToken: proof.data.token,
      stepUpRequestId: proof.data.requestId,
      idempotencyKey: proof.data.idempotencyKey,
      hmacKey: dependencies.hmacKey,
      prepared,
    });
    return { status: "registered" as const, packageId, evidence };
  } catch (error) {
    return databaseErrorCode(error) === "40001"
      ? { status: "conflict" as const }
      : { status: "unavailable" as const };
  }
}

function databaseErrorCode(error: unknown): string | null {
  return typeof error === "object" && error !== null && "code" in error
    ? String(error.code)
    : null;
}
