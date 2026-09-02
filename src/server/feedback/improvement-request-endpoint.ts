import "server-only";

import { z } from "zod";

import { hasValidSessionCsrfRequest } from "@/server/security/session-csrf";

const requestKindSchema = z.enum([
  "page_feedback",
  "form_request",
  "form_candidate",
]);
const categorySchema = z.enum([
  "not_working",
  "confusing",
  "wording",
  "missing",
  "idea",
  "missing_form",
  "outdated_form",
  "fillable_form",
  "form_problem",
]);
const requestedUseSchema = z.enum([
  "view_only",
  "browser_fillable",
  "workflow_connected",
]);
const fileMediaTypeSchema = z.enum([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
]);

export const MAX_FORM_CANDIDATE_BYTES = 10 * 1024 * 1024;

const targetSchema = z
  .object({
    id: z
      .string()
      .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/)
      .optional(),
    role: z
      .string()
      .regex(/^[A-Za-z][A-Za-z0-9_-]{0,63}$/)
      .optional(),
    label: z.string().trim().min(1).max(240).optional(),
  })
  .strict()
  .optional();

const fileSchema = z
  .object({
    name: z
      .string()
      .min(1)
      .max(160)
      .refine((name) => !/[\x00/\\]/.test(name)),
    mediaType: fileMediaTypeSchema,
    byteSize: z.number().int().min(1).max(MAX_FORM_CANDIDATE_BYTES),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();

const requestSchema = z
  .object({
    requestNonce: z.uuid(),
    requestKind: requestKindSchema,
    category: categorySchema,
    description: z.string().trim().min(3).max(4_000),
    routePath: z
      .string()
      .regex(/^\/[A-Za-z0-9/_-]*$/)
      .max(320)
      .optional(),
    target: targetSchema,
    viewport: z
      .object({
        width: z.number().int().min(320).max(10_000),
        height: z.number().int().min(320).max(10_000),
      })
      .strict()
      .optional(),
    form: z
      .object({
        title: z.string().trim().min(2).max(200),
        sourceAuthority: z.string().trim().min(2).max(160).optional(),
        sourceRevision: z.string().trim().min(1).max(160).optional(),
        requestedUse: requestedUseSchema,
      })
      .strict()
      .optional(),
    file: fileSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    const pageCategories = new Set([
      "not_working",
      "confusing",
      "wording",
      "missing",
      "idea",
    ]);
    const formCategories = new Set([
      "missing_form",
      "outdated_form",
      "fillable_form",
      "form_problem",
    ]);

    if (value.requestKind === "page_feedback") {
      if (!pageCategories.has(value.category) || value.form || value.file) {
        context.addIssue({ code: "custom", message: "Invalid page feedback." });
      }
      return;
    }

    if (!formCategories.has(value.category) || !value.form || value.target) {
      context.addIssue({ code: "custom", message: "Invalid form request." });
    }
    if (value.requestKind === "form_candidate" && !value.file) {
      context.addIssue({ code: "custom", message: "A file is required." });
    }
    if (value.requestKind === "form_request" && value.file) {
      context.addIssue({ code: "custom", message: "A file is not accepted." });
    }
  });

export type ImprovementRequestCommand = z.output<typeof requestSchema>;

export type ImprovementRequestValidation =
  | Readonly<{ ok: true; command: ImprovementRequestCommand }>
  | Readonly<{
      ok: false;
      status: 400 | 403 | 415;
      code: "invalid_request" | "invalid_origin" | "csrf_failed";
    }>;

/** Validates the same-origin, session-bound request before any database write. */
export async function validateImprovementRequest(
  request: Request,
  appOrigin: string,
  sessionId: string,
  csrfHmacKey: string,
): Promise<ImprovementRequestValidation> {
  if (request.headers.get("origin") !== appOrigin) {
    return { ok: false, status: 403, code: "invalid_origin" };
  }
  if (!hasValidSessionCsrfRequest(request.headers, sessionId, csrfHmacKey)) {
    return { ok: false, status: 403, code: "csrf_failed" };
  }
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return { ok: false, status: 415, code: "invalid_request" };
  }

  try {
    const parsed = requestSchema.safeParse(await request.json());
    return parsed.success
      ? { ok: true, command: parsed.data }
      : { ok: false, status: 400, code: "invalid_request" };
  } catch {
    return { ok: false, status: 400, code: "invalid_request" };
  }
}
