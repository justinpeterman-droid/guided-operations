import { z } from "zod";

export const INCIDENT_SCHEMA_VERSION = 1;

const opaqueIdSchema = z.uuid();
const nonEmptyText = (maximum: number) => z.string().trim().min(1).max(maximum);

export const fieldNoteSchema = z
  .object({
    id: opaqueIdSchema,
    text: nonEmptyText(20_000),
    recordedAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export const reviewedFactSchema = z.discriminatedUnion("state", [
  z
    .object({
      id: opaqueIdSchema,
      field: nonEmptyText(120),
      state: z.literal("confirmed"),
      value: nonEmptyText(8_000),
      sourceNoteIds: z.array(opaqueIdSchema).min(1).max(100),
    })
    .strict(),
  z
    .object({
      id: opaqueIdSchema,
      field: nonEmptyText(120),
      state: z.literal("unknown"),
      reason: nonEmptyText(500),
    })
    .strict(),
  z
    .object({
      id: opaqueIdSchema,
      field: nonEmptyText(120),
      state: z.literal("not_applicable"),
      reason: nonEmptyText(500),
    })
    .strict(),
]);

/** The user-reviewed source of truth for an immutable incident revision. */
export const incidentRevisionInputSchema = z
  .object({
    schemaVersion: z.literal(INCIDENT_SCHEMA_VERSION),
    incidentName: nonEmptyText(160),
    incidentNumber: nonEmptyText(80),
    occurredAt: z.iso.datetime({ offset: true }),
    category: nonEmptyText(100),
    fieldNotes: z.array(fieldNoteSchema).min(1).max(200),
    reviewedFacts: z.array(reviewedFactSchema).max(300),
  })
  .strict()
  .superRefine((revision, context) => {
    const factIds = revision.reviewedFacts.map((fact) => fact.id);
    if (new Set(factIds).size !== factIds.length) {
      context.addIssue({
        code: "custom",
        message: "Reviewed fact identifiers must be unique.",
        path: ["reviewedFacts"],
      });
    }
  });

/**
 * A draft can only reference confirmed facts from one immutable incident
 * revision. Narrative content deliberately belongs to a later reviewed report
 * revision, never to the initial draft request.
 */
export const reportDraftRequestSchema = z
  .object({
    schemaVersion: z.literal(INCIDENT_SCHEMA_VERSION),
    incidentId: opaqueIdSchema,
    sourceIncidentRevisionId: opaqueIdSchema,
    reportType: nonEmptyText(100),
    confirmedFactIds: z.array(opaqueIdSchema).min(1).max(300),
  })
  .strict()
  .superRefine((request, context) => {
    if (
      new Set(request.confirmedFactIds).size !== request.confirmedFactIds.length
    ) {
      context.addIssue({
        code: "custom",
        message: "Confirmed fact identifiers must be unique.",
        path: ["confirmedFactIds"],
      });
    }
  });

export type IncidentRevisionInput = z.infer<typeof incidentRevisionInputSchema>;
export type ReportDraftRequest = z.infer<typeof reportDraftRequestSchema>;
