import "server-only";

import { createHmac } from "node:crypto";
import { z } from "zod";

import {
  calculateCountTotals,
  validateCountPayload,
} from "@/features/count-sheet/calculations";
import { isApprovedCountSheetStructure } from "@/features/count-sheet/approved-structure";
import { parseCountSheetStructure } from "@/features/count-sheet/schema";
import type { CountSheetPayload } from "@/features/count-sheet/types";
import {
  authorizeCurrentSession,
  type CurrentSessionClient,
} from "@/server/auth/current-session";

const commandSchema = z
  .object({
    workDate: z.iso.date(),
    baseRevisionNumber: z.number().int().min(0),
    structure: z.unknown(),
    payload: z.unknown(),
    reason: z.string().trim().min(1).max(500),
    idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{16,128}$/),
  })
  .strict();

type SaveCountSheetClient = CurrentSessionClient &
  Readonly<{
    rpc(
      name: "save_count_sheet",
      args: Readonly<{
        p_work_date: string;
        p_base_revision_number: number;
        p_structure: unknown;
        p_payload: unknown;
        p_reason: string;
        p_idempotency_key_digest: string;
        p_request_digest: string;
      }>,
    ): PromiseLike<Readonly<{ data: unknown; error: unknown | null }>>;
  }>;

const resultSchema = z
  .array(
    z
      .object({
        record_id: z.uuid(),
        revision_number: z.number().int().positive(),
      })
      .strict(),
  )
  .length(1);

function digest(value: string, key: string, purpose: string): string {
  return createHmac("sha256", key)
    .update(purpose + "\u0000" + value, "utf8")
    .digest("hex");
}

function isConflict(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "40001"
  );
}

/**
 * Parses a closed fictional Count Sheet command, verifies current authority,
 * and asks the database to append the next immutable revision.
 */
export async function saveCountSheetForCurrentSession(
  candidate: unknown,
  client: SaveCountSheetClient,
  hmacKey: string,
) {
  const command = commandSchema.safeParse(candidate);
  if (!command.success) return { kind: "denied" as const };

  let structure;
  let payload: CountSheetPayload;
  try {
    structure = parseCountSheetStructure(command.data.structure);
    if (!isApprovedCountSheetStructure(structure))
      return { kind: "denied" as const };
    payload = validateCountPayload(
      structure,
      command.data.payload as CountSheetPayload,
    );
    calculateCountTotals(structure, payload);
  } catch {
    return { kind: "denied" as const };
  }

  if (!(await authorizeCurrentSession(client)).allowed)
    return { kind: "denied" as const };

  const request = {
    workDate: command.data.workDate,
    baseRevisionNumber: command.data.baseRevisionNumber,
    structure,
    payload,
    reason: command.data.reason,
  };

  try {
    const result = await client.rpc("save_count_sheet", {
      p_work_date: request.workDate,
      p_base_revision_number: request.baseRevisionNumber,
      p_structure: request.structure,
      p_payload: request.payload,
      p_reason: request.reason,
      p_idempotency_key_digest: digest(
        command.data.idempotencyKey,
        hmacKey,
        "count_sheet.save.key",
      ),
      p_request_digest: digest(
        JSON.stringify(request),
        hmacKey,
        "count_sheet.save.request",
      ),
    });
    const parsed = !result.error ? resultSchema.safeParse(result.data) : null;
    if (parsed?.success)
      return {
        kind: "saved" as const,
        recordId: parsed.data[0].record_id,
        revisionNumber: parsed.data[0].revision_number,
      };
    return isConflict(result.error)
      ? { kind: "conflict" as const }
      : { kind: "unavailable" as const };
  } catch {
    return { kind: "unavailable" as const };
  }
}
