import { z } from "zod";

import {
  REPORT_CHECKLIST_FIELD_PREFIX,
  validateReportChecklistAnswers,
  type ReportChecklistAnswer,
} from "./report-assistant-checklist";
import { reportTypeSchema } from "./report-types";

export const INCIDENT_SCHEMA_VERSION = 2;

const opaqueIdSchema = z.uuid();
const nonEmptyText = (maximum: number) => z.string().trim().min(1).max(maximum);

export const fieldNoteSchema = z
  .object({
    id: opaqueIdSchema,
    text: nonEmptyText(20_000),
    recordedAt: z.iso.datetime({ offset: true }),
  })
  .strict();

const reportingStaffMemberIdsSchema = z
  .array(opaqueIdSchema)
  .max(20)
  .superRefine((staffMemberIds, context) => {
    if (new Set(staffMemberIds).size !== staffMemberIds.length) {
      context.addIssue({
        code: "custom",
        message: "Reporting officer fact scopes must be unique.",
      });
    }
  });

const confirmedReviewedFactSchema = z
  .object({
    id: opaqueIdSchema,
    field: nonEmptyText(120),
    state: z.literal("confirmed"),
    value: nonEmptyText(8_000),
    sourceNoteIds: z.array(opaqueIdSchema).min(1).max(100),
    reportingStaffMemberIds: reportingStaffMemberIdsSchema,
  })
  .strict();

const legacyConfirmedReviewedFactSchema = z
  .object({
    id: opaqueIdSchema,
    field: nonEmptyText(120),
    state: z.literal("confirmed"),
    value: nonEmptyText(8_000),
    sourceNoteIds: z.array(opaqueIdSchema).min(1).max(100),
  })
  .strict();

const limitedReviewedFactSchemas = [
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
] as const;

export const reviewedFactSchema = z.discriminatedUnion("state", [
  confirmedReviewedFactSchema,
  ...limitedReviewedFactSchemas,
]);

/** Read compatibility for immutable version-one revisions created before fact scoping. */
export const storedReviewedFactSchema = z.union([
  reviewedFactSchema,
  legacyConfirmedReviewedFactSchema,
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
    const fieldNoteIds = new Set(revision.fieldNotes.map((note) => note.id));
    if (fieldNoteIds.size !== revision.fieldNotes.length) {
      context.addIssue({
        code: "custom",
        message: "Field note identifiers must be unique.",
        path: ["fieldNotes"],
      });
    }

    const factIds = revision.reviewedFacts.map((fact) => fact.id);
    if (new Set(factIds).size !== factIds.length) {
      context.addIssue({
        code: "custom",
        message: "Reviewed fact identifiers must be unique.",
        path: ["reviewedFacts"],
      });
    }

    revision.reviewedFacts.forEach((fact, factIndex) => {
      if (fact.state !== "confirmed") return;
      fact.sourceNoteIds.forEach((sourceNoteId, sourceNoteIndex) => {
        if (!fieldNoteIds.has(sourceNoteId)) {
          context.addIssue({
            code: "custom",
            message:
              "A confirmed fact must reference a field note in this revision.",
            path: [
              "reviewedFacts",
              factIndex,
              "sourceNoteIds",
              sourceNoteIndex,
            ],
          });
        }
      });
    });

    const checklistAnswers: ReportChecklistAnswer[] = [];
    let hasMalformedChecklistField = false;
    revision.reviewedFacts.forEach((fact) => {
      if (!fact.field.startsWith(REPORT_CHECKLIST_FIELD_PREFIX)) {
        return;
      }
      const questionIdEnd = fact.field.indexOf("]");
      const questionId = fact.field.slice(
        REPORT_CHECKLIST_FIELD_PREFIX.length,
        questionIdEnd,
      );
      if (questionIdEnd < 0 || !questionId) {
        hasMalformedChecklistField = true;
        return;
      }
      checklistAnswers.push(
        fact.state === "confirmed"
          ? { questionId, state: "answered", value: fact.value }
          : { questionId, state: fact.state },
      );
    });

    if (checklistAnswers.length || hasMalformedChecklistField) {
      const review = validateReportChecklistAnswers(
        revision.category,
        checklistAnswers,
      );
      if (hasMalformedChecklistField || !review.complete) {
        context.addIssue({
          code: "custom",
          message:
            "Candidate checklist facts must match one complete versioned category review.",
          path: ["reviewedFacts"],
        });
      }
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
    reportingStaffMemberId: opaqueIdSchema,
    reportType: reportTypeSchema,
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
export type ReviewedFact = z.infer<typeof reviewedFactSchema>;
export type StoredReviewedFact = z.infer<typeof storedReviewedFactSchema>;
