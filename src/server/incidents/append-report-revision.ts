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
    narrative: z.string().trim().min(1).max(50_000),
    reason: z.string().trim().min(1).max(500),
    idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{16,128}$/),
  })
  .strict();
type Client = Readonly<{
  rpc(
    n: "append_report_revision",
    a: Readonly<{
      p_report_id: string;
      p_base_revision_number: number;
      p_narrative: string;
      p_reason: string;
      p_idempotency_key_digest: string;
      p_request_digest: string;
    }>,
  ): PromiseLike<Readonly<{ data: unknown; error: unknown | null }>>;
}>;
export type AppendReportRevisionClient = CurrentSessionClient & Client;
const digest = (v: string, k: string, p: string) =>
  createHmac("sha256", k).update(`${p}\u0000${v}`, "utf8").digest("hex");
const isRevisionConflict = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === "40001";
export async function appendReportRevisionForCurrentSession(
  commandCandidate: unknown,
  client: AppendReportRevisionClient,
  key: string,
) {
  const parsed = schema.safeParse(commandCandidate);
  if (!parsed.success) return { kind: "denied" as const };
  if (!(await authorizeCurrentSession(client)).allowed)
    return { kind: "denied" as const };
  const c = parsed.data;
  try {
    const r = await client.rpc("append_report_revision", {
      p_report_id: c.reportId,
      p_base_revision_number: c.baseRevisionNumber,
      p_narrative: c.narrative,
      p_reason: c.reason,
      p_idempotency_key_digest: digest(
        c.idempotencyKey,
        key,
        "report.revise.key",
      ),
      p_request_digest: digest(
        JSON.stringify({
          reportId: c.reportId,
          baseRevisionNumber: c.baseRevisionNumber,
          narrative: c.narrative,
          reason: c.reason,
        }),
        key,
        "report.revise.request",
      ),
    });
    if (!r.error && typeof r.data === "number")
      return { kind: "revised" as const, revisionNumber: r.data };
    return isRevisionConflict(r.error)
      ? { kind: "conflict" as const }
      : { kind: "unavailable" as const };
  } catch {
    return { kind: "unavailable" as const };
  }
}
