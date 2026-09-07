import { z } from "zod";

import { reportChecklistAnswerSchema } from "./report-assistant-checklist";

export const INCIDENT_DRAFT_SCHEMA_VERSION = 1 as const;

const draftRelationshipKeySchema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}:(reporting_officer|involved_officer|witness)$/i,
  );

const factProposalSchema = z
  .object({
    key: z.string().min(1).max(256),
    sourceText: z.string().max(8_000),
    value: z.string().max(8_000),
    decision: z.enum(["pending", "confirmed", "excluded"]),
  })
  .strict();

/**
 * This is unfinished officer input, never an incident revision or a review
 * approval. The browser sends it only to the current account's private draft
 * boundary and it is revalidated before an incident can be created.
 */
export const incidentDraftEnvelopeSchema = z
  .object({
    schemaVersion: z.literal(INCIDENT_DRAFT_SCHEMA_VERSION),
    step: z.union([
      z.literal(1),
      z.literal(2),
      z.literal(3),
      z.literal(4),
      z.literal(5),
      z.literal(6),
    ]),
    officerConfirmed: z.boolean(),
    selectedRelationships: z.array(draftRelationshipKeySchema).max(60),
    factReportingScopes: z.record(
      z.string().min(1).max(256),
      z.array(z.uuid()).max(20),
    ),
    reportsReviewed: z.boolean(),
    incidentNumber: z.string().max(80),
    incidentName: z.string().max(160),
    occurredAt: z.string().max(64),
    location: z.string().max(8_000),
    category: z.string().max(100),
    categoryConfirmed: z.boolean(),
    notes: z.string().max(20_000),
    factProposals: z.array(factProposalSchema).max(200),
    unknown: z.string().max(500),
    checklistAnswers: z.array(reportChecklistAnswerSchema).max(100),
  })
  .strict()
  .superRefine((draft, context) => {
    if (
      new Set(draft.selectedRelationships).size !==
      draft.selectedRelationships.length
    ) {
      context.addIssue({
        code: "custom",
        message: "Draft officer relationships must be unique.",
        path: ["selectedRelationships"],
      });
    }
    if (
      new Set(draft.checklistAnswers.map((answer) => answer.questionId))
        .size !== draft.checklistAnswers.length
    ) {
      context.addIssue({
        code: "custom",
        message: "Draft checklist answers must be unique.",
        path: ["checklistAnswers"],
      });
    }
  });

export const incidentDraftSaveRequestSchema = z
  .object({
    draftId: z.uuid(),
    expectedRevision: z.number().int().nonnegative(),
    envelope: incidentDraftEnvelopeSchema,
  })
  .strict();

export type IncidentDraftEnvelope = z.infer<typeof incidentDraftEnvelopeSchema>;
export type IncidentDraftSaveRequest = z.infer<
  typeof incidentDraftSaveRequestSchema
>;

export type IncidentDraftSummary = Readonly<{
  draftId: string;
  revisionNumber: number;
  incidentNumber: string | null;
  incidentName: string | null;
  savedAt: string;
}>;

export type IncidentDraft = IncidentDraftSummary &
  Readonly<{ envelope: IncidentDraftEnvelope }>;

export function draftSummaryFields(envelope: IncidentDraftEnvelope) {
  return {
    incidentNumber: envelope.incidentNumber.trim() || null,
    incidentName: envelope.incidentName.trim() || null,
  };
}
