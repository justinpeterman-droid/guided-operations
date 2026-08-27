import { z } from "zod";

import {
  incidentRevisionInputSchema,
  type IncidentRevisionInput,
} from "./schema";
import { incidentStaffRelationshipsSchema } from "./incident-staff-relationships";

const idempotencyKeySchema = z.string().regex(/^[A-Za-z0-9_-]{16,128}$/);

export const createIncidentCommandSchema = z
  .object({
    revision: incidentRevisionInputSchema,
    staffRelationships: incidentStaffRelationshipsSchema,
    idempotencyKey: idempotencyKeySchema,
  })
  .strict();

export type CreateIncidentCommand = z.infer<typeof createIncidentCommandSchema>;

/** A server authorization layer supplies actor/facility IDs; the browser cannot. */
export type AuthorizedCreateIncident = Readonly<{
  actorAccountId: string;
  facilityId: string;
  command: CreateIncidentCommand;
}>;

export type IncidentCreatePersistence = Readonly<{
  incidentNumber: string;
  incidentName: string;
  occurredAt: string;
  category: string;
  revision: IncidentRevisionInput;
}>;

export function toIncidentCreatePersistence(
  authorized: AuthorizedCreateIncident,
): IncidentCreatePersistence {
  return {
    incidentNumber: authorized.command.revision.incidentNumber,
    incidentName: authorized.command.revision.incidentName,
    occurredAt: authorized.command.revision.occurredAt,
    category: authorized.command.revision.category,
    revision: authorized.command.revision,
  };
}
