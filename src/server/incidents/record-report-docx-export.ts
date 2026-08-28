import "server-only";

import { createHmac } from "node:crypto";
import { z } from "zod";

import {
  authorizeCurrentSession,
  type CurrentSessionClient,
} from "@/server/auth/current-session";

const commandSchema = z
  .object({
    reportId: z.uuid(),
    revisionNumber: z.number().int().positive(),
    outputSha256: z.string().regex(/^[a-f0-9]{64}$/),
    sizeBytes: z.number().int().min(1).max(52_428_800),
    templateVersion: z.string().regex(/^[a-z0-9][a-z0-9._-]{0,79}$/),
    idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{16,128}$/),
    requestId: z.uuid(),
  })
  .strict();

type Client = CurrentSessionClient &
  Readonly<{
    rpc(
      name: "record_report_docx_export",
      args: Readonly<{
        p_report_id: string;
        p_revision_number: number;
        p_output_sha256: string;
        p_size_bytes: number;
        p_template_version: string;
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

function errorCode(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error
    ? error.code
    : null;
}

export async function recordReportDocxExport(
  candidate: unknown,
  client: Client,
  hmacKey: string,
) {
  const command = commandSchema.safeParse(candidate);
  if (!command.success || !(await authorizeCurrentSession(client)).allowed)
    return { kind: "denied" as const };

  const requestIdentity = {
    reportId: command.data.reportId,
    revisionNumber: command.data.revisionNumber,
    outputSha256: command.data.outputSha256,
    sizeBytes: command.data.sizeBytes,
    templateVersion: command.data.templateVersion,
  };
  try {
    const result = await client.rpc("record_report_docx_export", {
      p_report_id: command.data.reportId,
      p_revision_number: command.data.revisionNumber,
      p_output_sha256: command.data.outputSha256,
      p_size_bytes: command.data.sizeBytes,
      p_template_version: command.data.templateVersion,
      p_idempotency_key_digest: digest(
        command.data.idempotencyKey,
        hmacKey,
        "report.docx.key",
      ),
      p_request_digest: digest(
        JSON.stringify(requestIdentity),
        hmacKey,
        "report.docx.request",
      ),
      p_request_id: command.data.requestId,
    });
    const eventId = z.uuid().safeParse(result.data);
    if (!result.error && eventId.success)
      return { kind: "recorded" as const, exportId: eventId.data };
    const code = errorCode(result.error);
    if (code === "42501") return { kind: "denied" as const };
    if (code === "40001" || code === "22023")
      return { kind: "conflict" as const };
    return { kind: "unavailable" as const };
  } catch {
    return { kind: "unavailable" as const };
  }
}
