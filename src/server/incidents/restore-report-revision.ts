import "server-only";

import { createHmac } from "node:crypto";
import { z } from "zod";

import {
  authorizeCurrentSession,
  type CurrentSessionClient,
} from "@/server/auth/current-session";

const schema = z
  .object({
    reportId: z.uuid(),
    baseRevisionNumber: z.number().int().positive(),
    restoreRevisionNumber: z.number().int().positive(),
    reason: z.string().trim().min(1).max(500),
    idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{16,128}$/),
  })
  .strict();
type Client = Readonly<{
  rpc(
    name: "restore_report_revision",
    args: Readonly<{
      p_report_id: string;
      p_base_revision_number: number;
      p_restore_revision_number: number;
      p_reason: string;
      p_idempotency_key_digest: string;
      p_request_digest: string;
    }>,
  ): PromiseLike<Readonly<{ data: unknown; error: unknown | null }>>;
}>;
export type RestoreReportRevisionClient = CurrentSessionClient & Client;
const digest = (value: string, key: string, purpose: string) =>
  createHmac("sha256", key)
    .update(`${purpose}\u0000${value}`, "utf8")
    .digest("hex");
const conflict = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === "40001";

export async function restoreReportRevisionForCurrentSession(
  candidate: unknown,
  client: RestoreReportRevisionClient,
  key: string,
) {
  const parsed = schema.safeParse(candidate);
  if (!parsed.success || !(await authorizeCurrentSession(client)).allowed)
    return { kind: "denied" as const };
  const command = parsed.data;
  try {
    const result = await client.rpc("restore_report_revision", {
      p_report_id: command.reportId,
      p_base_revision_number: command.baseRevisionNumber,
      p_restore_revision_number: command.restoreRevisionNumber,
      p_reason: command.reason,
      p_idempotency_key_digest: digest(
        command.idempotencyKey,
        key,
        "report.restore.key",
      ),
      p_request_digest: digest(
        JSON.stringify({
          reportId: command.reportId,
          baseRevisionNumber: command.baseRevisionNumber,
          restoreRevisionNumber: command.restoreRevisionNumber,
          reason: command.reason,
        }),
        key,
        "report.restore.request",
      ),
    });
    if (!result.error && typeof result.data === "number")
      return { kind: "restored" as const, revisionNumber: result.data };
    return conflict(result.error)
      ? { kind: "conflict" as const }
      : { kind: "unavailable" as const };
  } catch {
    return { kind: "unavailable" as const };
  }
}
