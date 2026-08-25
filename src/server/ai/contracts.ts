import "server-only";

import type {
  GroundedPolicyAnswer,
  SourceCitation,
} from "@/features/policy/grounding";
import type { GeneratedReportDraft } from "@/features/incidents/generated-report-draft";
import type { ReportDraftSource } from "@/features/incidents/report-draft-source";

export interface RetrievedPolicyPassage {
  citation: SourceCitation;
  relevanceScore: number;
}

export interface PolicyRetrievalRequest {
  facilityId: string;
  question: string;
  maximumPassages: number;
  approvedDocumentVersionIds?: string[];
}

export interface PolicyRetrievalProvider {
  readonly providerKey: string;
  retrieve(request: PolicyRetrievalRequest): Promise<RetrievedPolicyPassage[]>;
}

export interface GroundedGenerationRequest {
  question: string;
  passages: RetrievedPolicyPassage[];
  maximumAnswerCharacters: number;
}

export interface GroundedGenerationProvider {
  readonly providerKey: string;
  generate(request: GroundedGenerationRequest): Promise<GroundedPolicyAnswer>;
}

/**
 * A report provider receives only officer-confirmed facts. Its output remains a
 * candidate and must pass source-reference validation before human review.
 */
export interface ReportDraftGenerationRequest {
  source: ReportDraftSource;
  maximumParagraphs: number;
  maximumParagraphCharacters: number;
}

export interface ReportDraftGenerationProvider {
  readonly providerKey: string;
  generate(
    request: ReportDraftGenerationRequest,
  ): Promise<GeneratedReportDraft>;
}
