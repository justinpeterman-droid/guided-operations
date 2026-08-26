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
    revisionNumber: z.number().int().positive(),
    idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{16,128}$/),
    requestId: z.uuid(),
  })
  .strict();

type RecordCountSheetPrintClient = CurrentSessionClient &
  Readonly<{
    rpc(
      name: "record_count_sheet_print",
      args: Readonly<{
        p_record_id: string;
        p_revision_number: number;
        p_idempotency_key_digest: string;
        p_request_digest: string;
        p_request_id: string;
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

export async function recordCountSheetPrintForCurrentSession(
  candidate: unknown,
  client: RecordCountSheetPrintClient,
  hmacKey: string,
) {
  const command = commandSchema.safeParse(candidate);
  if (!command.success || !(await authorizeCurrentSession(client)).allowed)
    return { kind: "denied" as const };

  const request = {
    recordId: command.data.recordId,
    revisionNumber: command.data.revisionNumber,
    requestId: command.data.requestId,
  };

  try {
    const result = await client.rpc("record_count_sheet_print", {
      p_record_id: request.recordId,
      p_revision_number: request.revisionNumber,
      p_idempotency_key_digest: digest(
        command.data.idempotencyKey,
        hmacKey,
        "count_sheet.print.key",
      ),
      p_request_digest: digest(
        JSON.stringify({
          recordId: request.recordId,
          revisionNumber: request.revisionNumber,
        }),
        hmacKey,
        "count_sheet.print.request",
      ),
      p_request_id: request.requestId,
    });
    if (!result.error && z.uuid().safeParse(result.data).success)
      return { kind: "recorded" as const };
    return isConflict(result.error)
      ? { kind: "conflict" as const }
      : { kind: "unavailable" as const };
  } catch {
    return { kind: "unavailable" as const };
  }
}
