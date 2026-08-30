import "server-only";

import {
  IncidentFactExtractionError,
  buildIncidentFactExtractionRequest,
  validateIncidentFactExtraction,
  type IncidentFactExtractionResult,
} from "@/features/incidents/incident-fact-extraction";

import { AiBudgetCircuitOpenError } from "./ai-request-budget";
import type { IncidentFactExtractionProvider } from "./contracts";

export type IncidentFactExtractionOutcome =
  | Readonly<{ kind: "suggested"; result: IncidentFactExtractionResult }>
  | Readonly<{ kind: "invalid_source" | "invalid_output" }>
  | Readonly<{
      kind: "provider_unavailable";
      reasonCode:
        | "generation_failed"
        | "budget_check_failed"
        | "budget_exhausted"
        | "generation_disabled";
    }>;

/** Produces review-only suggestions. It never writes an incident or confirms a fact. */
export function createIncidentFactExtractionService(
  provider: IncidentFactExtractionProvider,
) {
  return {
    async suggest(notes: string): Promise<IncidentFactExtractionOutcome> {
      let request;
      try {
        request = buildIncidentFactExtractionRequest(notes);
      } catch (error) {
        return error instanceof IncidentFactExtractionError &&
          error.code === "invalid_source"
          ? { kind: "invalid_source" }
          : { kind: "invalid_output" };
      }

      try {
        const candidate = await provider.generate(request);
        return {
          kind: "suggested",
          result: validateIncidentFactExtraction(candidate, request),
        };
      } catch (error) {
        if (error instanceof AiBudgetCircuitOpenError) {
          return {
            kind: "provider_unavailable",
            reasonCode: error.reasonCode,
          };
        }
        return error instanceof IncidentFactExtractionError
          ? { kind: "invalid_output" }
          : { kind: "provider_unavailable", reasonCode: "generation_failed" };
      }
    },
  };
}
