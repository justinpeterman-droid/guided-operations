import "server-only";

import { createHmac } from "node:crypto";

import { z } from "zod";

import {
  authorizeCurrentSession,
  type CurrentSessionClient,
} from "@/server/auth/current-session";

const commandSchema = z
  .object({
    candidateId: z.uuid(),
    narrative: z.string().trim().min(1).max(50_000),
    idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{16,128}$/),
    reviewedByOfficer: z.literal(true),
  })
  .strict();

type FinalizeReportRpcClient = Readonly<{
  rpc(
    functionName: "finalize_report_draft_candidate",
    arguments_: Readonly<{
      p_candidate_id: string;
      p_narrative: string;
      p_idempotency_key_digest: string;
      p_request_digest: string;
    }>,
  ): PromiseLike<Readonly<{ data: unknown; error: unknown | null }>>;
}>;

export type FinalizeReportSessionClient = CurrentSessionClient &
  FinalizeReportRpcClient;

export type FinalizeReportResult =
  | Readonly<{ kind: "finalized"; reportId: string }>
  | Readonly<{ kind: "denied" }>
  | Readonly<{ kind: "conflict" }>
  | Readonly<{ kind: "unavailable" }>;

function hasRpcErrorCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === code
  );
}

function digest(value: string, key: string, purpose: string): string {
  return createHmac("sha256", key)
    .update(`${purpose}\u0000${value}`, "utf8")
    .digest("hex");
}

/** Requires an explicit human-review attestation before creating a report. */
export async function finalizeReportDraftForCurrentSession(
  commandCandidate: unknown,
  client: FinalizeReportSessionClient,
  idempotencyHmacKey: string,
): Promise<FinalizeReportResult> {
  const command = commandSchema.safeParse(commandCandidate);
  if (!command.success) return { kind: "denied" };
  const session = await authorizeCurrentSession(client);
  if (!session.allowed) return { kind: "denied" };

  const canonicalRequest = JSON.stringify({
    candidateId: command.data.candidateId,
    narrative: command.data.narrative,
    reviewedByOfficer: true,
  });
  try {
    const result = await client.rpc("finalize_report_draft_candidate", {
      p_candidate_id: command.data.candidateId,
      p_narrative: command.data.narrative,
      p_idempotency_key_digest: digest(
        command.data.idempotencyKey,
        idempotencyHmacKey,
        "report.finalize.key",
      ),
      p_request_digest: digest(
        canonicalRequest,
        idempotencyHmacKey,
        "report.finalize.request",
      ),
    });
    if (hasRpcErrorCode(result.error, "42501")) return { kind: "denied" };
    if (hasRpcErrorCode(result.error, "40001")) return { kind: "conflict" };
    return !result.error && typeof result.data === "string"
      ? { kind: "finalized", reportId: result.data }
      : { kind: "unavailable" };
  } catch {
    return { kind: "unavailable" };
  }
}
