import "server-only";

import type { SourceCitation } from "@/features/policy/grounding";
import type { GeneratedReportDraft } from "@/features/incidents/generated-report-draft";
import type { ReportDraftGenerationSource } from "@/features/incidents/report-draft-source";
import type { IncidentFactExtractionRequest } from "@/features/incidents/incident-fact-extraction";

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

export interface PolicyConversationContext {
  /** Prior user questions only. They help resolve references but are not evidence. */
  previousUserQuestions: string[];
}

export interface GroundedGenerationRequest {
  question: string;
  passages: RetrievedPolicyPassage[];
  maximumAnswerCharacters: number;
  conversationContext?: PolicyConversationContext;
}

export interface GroundedGenerationProvider {
  readonly providerKey: string;
  /** Untrusted provider output; the caller must validate schema and provenance. */
  generate(request: GroundedGenerationRequest): Promise<unknown>;
}

/**
 * A report provider receives only officer-confirmed facts. Its output remains a
 * candidate and must pass source-reference validation before human review.
 */
export interface ReportDraftGenerationRequest {
  source: ReportDraftGenerationSource;
  maximumParagraphs: number;
  maximumParagraphCharacters: number;
}

export interface ReportDraftGenerationProvider {
  readonly providerKey: string;
  generate(
    request: ReportDraftGenerationRequest,
  ): Promise<GeneratedReportDraft>;
}

export interface IncidentFactExtractionProvider {
  readonly providerKey: string;
  /** Untrusted provider output; the service restores provenance and validates it. */
  generate(request: IncidentFactExtractionRequest): Promise<unknown>;
}
