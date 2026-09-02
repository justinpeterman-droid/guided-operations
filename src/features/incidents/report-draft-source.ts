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

const offsetTimestampPattern =
  /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/u;

/**
 * Builds a provider-only projection of confirmed facts. Exact ISO timestamps
 * are rendered in the report's required 12-hour style so the provider is not
 * asked to choose between conflicting time-format and numeric-provenance rules.
 * Stored reviewed facts remain unchanged.
 */
export function buildReportDraftGenerationSource(
  source: ReportDraftSource,
): ReportDraftGenerationSource {
  return {
    incidentId: source.incidentId,
    sourceIncidentRevisionId: source.sourceIncidentRevisionId,
    reportType: source.reportType,
    confirmedFacts: source.confirmedFacts.map((fact) => ({
      ...fact,
      value: formatDraftingValue(fact.value),
    })),
  };
}

function formatDraftingValue(value: string): string {
  const timestamp = offsetTimestampPattern.exec(value);
  if (!timestamp) return value;

  const [, date, hourText, minute, offset] = timestamp;
  const hour = Number(hourText);
  const narrativeHour = hour % 12 || 12;
  const meridiem = hour < 12 ? "am" : "pm";
  const timezone = offset === "Z" ? "UTC" : `UTC${offset.replace(":", "")}`;
  return `${date} at ${narrativeHour}:${minute} ${meridiem} ${timezone}`;
}

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
