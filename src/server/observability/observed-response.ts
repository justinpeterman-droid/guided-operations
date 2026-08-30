import "server-only";

import {
  writeSafeOperationalEvent,
  type SafeOperationalEventInput,
} from "./safe-operational-event";

/** Returns a bounded whole-millisecond duration for the allowlisted event. */
export function boundedOperationalDuration(startedAt: number): number {
  return Math.min(3_600_000, Math.max(0, Math.trunc(Date.now() - startedAt)));
}

/**
 * Adds one opaque correlation header and emits only the strict value-free
 * operational event. Locally created route responses have mutable headers.
 */
export function observedResponse(
  response: Response,
  event: SafeOperationalEventInput,
): Response {
  response.headers.set("x-request-id", event.request_id);
  writeSafeOperationalEvent(event);
  return response;
}
