import "server-only";

import { createHmac } from "node:crypto";
import { z } from "zod";

import {
  authorizeCurrentSession,
  type CurrentSessionClient,
} from "@/server/auth/current-session";

const commandSchema = z
  .object({
    recordId: z.uuid(),
    baseRevisionNumber: z.number().int().positive(),
    restoreRevisionNumber: z.number().int().positive(),
    reason: z.string().trim().min(1).max(500),
    idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{16,128}$/),
  })
  .strict();

type RestoreDailyPaperworkClient = CurrentSessionClient &
  Readonly<{
    rpc(
      name: "restore_daily_paperwork_revision_v2",
      args: Readonly<{
        p_record_id: string;
        p_base_revision_number: number;
        p_restore_revision_number: number;
        p_reason: string;
        p_idempotency_key_digest: string;
        p_request_digest: string;
      }>,
    ): PromiseLike<Readonly<{ data: unknown; error: unknown | null }>>;
  }>;

function digest(value: string, key: string, purpose: string) {
  return createHmac("sha256", key)
    .update(`${purpose}\u0000${value}`, "utf8")
    .digest("hex");
}

function isConflict(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "40001"
  );
}

export async function restoreDailyPaperworkRevisionForCurrentSession(
  candidate: unknown,
  client: RestoreDailyPaperworkClient,
  hmacKey: string,
) {
  const command = commandSchema.safeParse(candidate);
  if (
    !command.success ||
    !(
      await authorizeCurrentSession(client, {
        requiredRole: "administrator",
      })
    ).allowed
  )
    return { kind: "denied" as const };
  const request = {
    recordId: command.data.recordId,
    baseRevisionNumber: command.data.baseRevisionNumber,
    restoreRevisionNumber: command.data.restoreRevisionNumber,
    reason: command.data.reason,
  };
  try {
    const result = await client.rpc("restore_daily_paperwork_revision_v2", {
      p_record_id: request.recordId,
      p_base_revision_number: request.baseRevisionNumber,
      p_restore_revision_number: request.restoreRevisionNumber,
      p_reason: request.reason,
      p_idempotency_key_digest: digest(
        command.data.idempotencyKey,
        hmacKey,
        "daily_paperwork.restore.key",
      ),
      p_request_digest: digest(
        JSON.stringify(request),
        hmacKey,
        "daily_paperwork.restore.request",
      ),
    });
    if (!result.error && typeof result.data === "number")
      return { kind: "restored" as const, revisionNumber: result.data };
    return isConflict(result.error)
      ? { kind: "conflict" as const }
      : { kind: "unavailable" as const };
  } catch {
    return { kind: "unavailable" as const };
  }
}
