import "server-only";

import { randomUUID } from "node:crypto";

import {
  boundedOperationalDuration,
  observedResponse,
} from "./observed-response";
import type { SafeOperationalEventInput } from "./safe-operational-event";

/**
 * Creates one request-scoped observer for administrator step-up responses.
 * The caller supplies only an allowlisted outcome and environment; passcodes,
 * proof tokens, identities, and action targets cannot enter the event shape.
 */
export function createAdminStepUpObserver(): (
  response: Response,
  outcome: SafeOperationalEventInput["outcome"],
  environment: SafeOperationalEventInput["environment"],
) => Response {
  const requestId = randomUUID();
  const startedAt = Date.now();

  return (response, outcome, environment) =>
    observedResponse(response, {
      event_name: "admin.step_up",
      outcome,
      request_id: requestId,
      status_code: response.status,
      duration_ms: boundedOperationalDuration(startedAt),
      environment,
    });
}
