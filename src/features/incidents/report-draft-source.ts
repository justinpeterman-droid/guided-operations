import {
  reportDraftRequestSchema,
  type ReportDraftRequest,
  type StoredReviewedFact,
} from "./schema";
import type { ReportType } from "./report-types";

export class ReportDraftSourceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReportDraftSourceError";
  }
}

export type ConfirmedReportFact = {
  id: string;
  field: string;
  value: string;
  sourceNoteIds: string[];
};

export type ReportDraftSource = {
  incidentId: string;
  sourceIncidentRevisionId: string;
  reportingStaffMemberId: string;
  reportType: ReportType;
  confirmedFacts: ConfirmedReportFact[];
};

/** The provider never receives the staff identity used for database attribution. */
export type ReportDraftGenerationSource = Omit<
  ReportDraftSource,
  "reportingStaffMemberId"
>;

/**
 * Select the only fact data a report-drafting adapter may receive. This keeps
 * proposed, unknown, and not-applicable facts outside both generated and
 * human-reviewed report-draft inputs.
 */
export function buildReportDraftSource(
  request: ReportDraftRequest,
  sourceIncidentRevisionId: string,
  reviewedFacts: readonly StoredReviewedFact[],
): ReportDraftSource {
  const parsedRequest = reportDraftRequestSchema.parse(request);
  if (parsedRequest.sourceIncidentRevisionId !== sourceIncidentRevisionId) {
    throw new ReportDraftSourceError(
      "The selected facts do not belong to the requested incident revision.",
    );
  }

  const factsById = new Map(reviewedFacts.map((fact) => [fact.id, fact]));
  const confirmedFacts = parsedRequest.confirmedFactIds.map((factId) => {
    const fact = factsById.get(factId);
    if (
      !fact ||
      fact.state !== "confirmed" ||
      !("reportingStaffMemberIds" in fact) ||
      !fact.reportingStaffMemberIds.includes(
        parsedRequest.reportingStaffMemberId,
      )
    ) {
      throw new ReportDraftSourceError(
        "A report draft may reference only confirmed facts scoped to its reporting officer.",
      );
    }

    return {
      id: fact.id,
      field: fact.field,
      value: fact.value,
      sourceNoteIds: [...fact.sourceNoteIds],
    };
  });

  return {
    incidentId: parsedRequest.incidentId,
    sourceIncidentRevisionId: parsedRequest.sourceIncidentRevisionId,
    reportingStaffMemberId: parsedRequest.reportingStaffMemberId,
    reportType: parsedRequest.reportType,
    confirmedFacts,
  };
}
