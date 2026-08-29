import "server-only";

import { z } from "zod";

import {
  GroundedPolicyAnswerError,
  type GroundedPolicyAnswer,
  type PolicyCollection,
  validateGroundedPolicyAnswer,
} from "@/features/policy/grounding";

import type {
  GroundedGenerationProvider,
  PolicyRetrievalProvider,
  RetrievedPolicyPassage,
} from "./contracts";
import { AiBudgetCircuitOpenError } from "./ai-request-budget";

const questionSchema = z.string().trim().min(3).max(2_000);
const facilityIdSchema = z.uuid();
const historySchema = z
  .array(z.object({ question: questionSchema }).strict())
  .max(6);

const likelyFollowUpPattern =
  /^(?:and|but|what about|how about|does that|do they|is that|are they|when does|where does|why does|can (?:i|we|they)|what if)\b|\b(?:it|that|this|they|them|those|these|same|there)\b/i;

export type PolicyAnswerRequest = Readonly<{
  facilityId: string;
  question: string;
  history?: readonly Readonly<{ question: string }>[];
  approvedDocumentVersionIds?: readonly string[];
  collections?: readonly PolicyCollection[];
}>;

export type PolicyAnswerServiceOptions = Readonly<{
  maximumPassages: number;
  maximumAnswerCharacters: number;
}>;

export type PolicyAnswerOutcome =
  | Readonly<{ kind: "answer"; answer: GroundedPolicyAnswer }>
  | Readonly<{
      kind: "insufficient_evidence";
      answer: GroundedPolicyAnswer;
    }>
  | Readonly<{
      kind: "provider_unavailable";
      reasonCode:
        | "retrieval_failed"
        | "generation_failed"
        | "invalid_output"
        | "budget_check_failed"
        | "budget_exhausted"
        | "generation_disabled";
    }>;

export type PolicyAnswerDependencies = Readonly<{
  retrieval: PolicyRetrievalProvider;
  generation: GroundedGenerationProvider;
}>;

const noEvidenceAnswer: GroundedPolicyAnswer = {
  status: "insufficient_evidence",
  answer:
    "The approved policy sources available to this session do not establish an answer.",
  citations: [],
  limitations: [
    "No authorized passage was retrieved for this question. Check the source material or ask a supervisor.",
  ],
};

function buildRetrievalQuestion(
  question: string,
  history: readonly Readonly<{ question: string }>[],
): string {
  const latestQuestion = history.at(-1)?.question;
  if (!latestQuestion || !likelyFollowUpPattern.test(question)) return question;

  const availableContextCharacters = 2_000 - question.length - 1;
  if (availableContextCharacters < 3) return question;
  return `${latestQuestion.slice(0, availableContextCharacters)} ${question}`;
}

/**
 * Composes retrieval, generation, and immutable-citation validation without
 * retaining the question, answer, or excerpt. The caller owns authorization,
 * transient rendering, and safe operational metrics.
 */
export function createPolicyAnswerService(
  dependencies: PolicyAnswerDependencies,
  options: PolicyAnswerServiceOptions,
) {
  if (options.maximumPassages < 1 || options.maximumPassages > 12) {
    throw new Error("Policy answers require between 1 and 12 passages.");
  }

  if (
    options.maximumAnswerCharacters < 1 ||
    options.maximumAnswerCharacters > 8_000
  ) {
    throw new Error("Policy answers require a bounded answer length.");
  }

  return {
    async answer(request: PolicyAnswerRequest): Promise<PolicyAnswerOutcome> {
      const question = questionSchema.parse(request.question);
      const facilityId = facilityIdSchema.parse(request.facilityId);
      const history = historySchema.parse(request.history ?? []);
      const retrievalQuestion = buildRetrievalQuestion(question, history);

      let passages: RetrievedPolicyPassage[];
      try {
        passages = await dependencies.retrieval.retrieve({
          facilityId,
          question: retrievalQuestion,
          maximumPassages: options.maximumPassages,
          approvedDocumentVersionIds: request.approvedDocumentVersionIds
            ? [...request.approvedDocumentVersionIds]
            : undefined,
          ...(request.collections
            ? { collections: [...request.collections] }
            : {}),
        });
      } catch (error) {
        if (error instanceof AiBudgetCircuitOpenError) {
          return {
            kind: "provider_unavailable",
            reasonCode: error.reasonCode,
          };
        }
        return { kind: "provider_unavailable", reasonCode: "retrieval_failed" };
      }

      if (passages.length === 0) {
        return { kind: "insufficient_evidence", answer: noEvidenceAnswer };
      }

      try {
        const candidate = await dependencies.generation.generate({
          question,
          passages,
          maximumAnswerCharacters: options.maximumAnswerCharacters,
          ...(history.length
            ? {
                conversationContext: {
                  previousUserQuestions: history.map((turn) => turn.question),
                },
              }
            : {}),
        });
        const answer = validateGroundedPolicyAnswer(
          candidate,
          passages.map((passage) => passage.citation),
        );

        return answer.status === "answered"
          ? { kind: "answer", answer }
          : { kind: "insufficient_evidence", answer };
      } catch (error) {
        if (error instanceof AiBudgetCircuitOpenError) {
          return {
            kind: "provider_unavailable",
            reasonCode: error.reasonCode,
          };
        }
        return {
          kind: "provider_unavailable",
          reasonCode:
            error instanceof GroundedPolicyAnswerError ||
            error instanceof z.ZodError
              ? "invalid_output"
              : "generation_failed",
        };
      }
    },
  };
}
