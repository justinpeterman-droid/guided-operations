import "server-only";

import { createHmac } from "node:crypto";
import { z } from "zod";

import {
  parseDailyPaperworkPayload,
  type DailyPaperworkPayload,
} from "@/features/daily-paperwork/form-schema";
import {
  dailyPaperworkKindSchema,
  shiftCodeSchema,
  type DailyPaperworkKind,
  type ShiftCode,
} from "@/features/daily-paperwork/catalog";
import type { Json } from "@/lib/supabase/database.generated";
import {
  authorizeCurrentSession,
  type CurrentSessionClient,
} from "@/server/auth/current-session";

import {
  parseDailyPaperworkRpcRow,
  type GetDailyPaperworkRpcClient,
} from "./get-daily-paperwork";

const commandSchema = z
  .object({
    kind: dailyPaperworkKindSchema,
    workDate: z.iso.date(),
    shiftCode: shiftCodeSchema,
    baseRevisionNumber: z.number().int().min(0),
    payload: z.unknown(),
    reason: z.string().trim().min(1).max(500),
    idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{16,128}$/),
  })
  .strict();

type SaveDailyPaperworkRpcClient = Readonly<{
  rpc(
    name: "save_daily_paperwork_v2",
    args: Readonly<{
      p_template_code: DailyPaperworkKind;
      p_work_date: string;
      p_shift_code: ShiftCode;
      p_base_revision_number: number;
      p_payload: Json;
      p_reason: string;
      p_idempotency_key_digest: string;
      p_request_digest: string;
    }>,
  ): PromiseLike<Readonly<{ data: unknown; error: unknown | null }>>;
}>;

type SaveDailyPaperworkClient = CurrentSessionClient &
  GetDailyPaperworkRpcClient &
  SaveDailyPaperworkRpcClient;

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
    .update(`${purpose}\u0000${value}`, "utf8")
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
 * Revalidates the server-owned private form before sending only the entered
 * values to the database. Layout, schema, facility, and template ID never come
 * from the browser save command.
 */
export async function saveDailyPaperworkForCurrentSession(
  candidate: unknown,
  client: SaveDailyPaperworkClient,
  hmacKey: string,
) {
  const command = commandSchema.safeParse(candidate);
  if (!command.success) return { kind: "denied" as const };
  const session = await authorizeCurrentSession(client, {
    requiredRole: "administrator",
  });
  if (!session.allowed) return { kind: "denied" as const };

  const expected = {
    kind: command.data.kind,
    workDate: command.data.workDate,
    shiftCode: command.data.shiftCode,
  };

  try {
    const definitionResult = await client.rpc("get_daily_paperwork_v2", {
      p_template_code: expected.kind,
      p_work_date: expected.workDate,
      p_shift_code: expected.shiftCode,
    });
    if (
      definitionResult.error ||
      !Array.isArray(definitionResult.data) ||
      definitionResult.data.length !== 1
    )
      return { kind: "unavailable" as const };
    const paperwork = parseDailyPaperworkRpcRow(
      definitionResult.data[0],
      expected,
    );
    if (!paperwork) return { kind: "unavailable" as const };
    if (!paperwork.editable) return { kind: "readonly" as const };
    if (paperwork.currentRevisionNumber !== command.data.baseRevisionNumber)
      return { kind: "conflict" as const };

    const payload: DailyPaperworkPayload = parseDailyPaperworkPayload(
      paperwork.fieldSchema,
      command.data.payload,
    );
    const request = {
      kind: expected.kind,
      workDate: expected.workDate,
      shiftCode: expected.shiftCode,
      baseRevisionNumber: command.data.baseRevisionNumber,
      payload,
      reason: command.data.reason,
    };
    const result = await client.rpc("save_daily_paperwork_v2", {
      p_template_code: request.kind,
      p_work_date: request.workDate,
      p_shift_code: request.shiftCode,
      p_base_revision_number: request.baseRevisionNumber,
      p_payload: request.payload as unknown as Json,
      p_reason: request.reason,
      p_idempotency_key_digest: digest(
        command.data.idempotencyKey,
        hmacKey,
        "daily_paperwork.save.key",
      ),
      p_request_digest: digest(
        JSON.stringify(request),
        hmacKey,
        "daily_paperwork.save.request",
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
