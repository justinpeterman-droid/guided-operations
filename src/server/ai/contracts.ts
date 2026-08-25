import "server-only";

import type {
  GroundedPolicyAnswer,
  SourceCitation,
} from "@/features/policy/grounding";

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
