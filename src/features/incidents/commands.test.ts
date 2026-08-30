import { describe, expect, it } from "vitest";
import {
  createIncidentCommandSchema,
  toIncidentCreatePersistence,
} from "./commands";

const revision = {
  schemaVersion: 2,
  incidentName: "Fictional scenario",
  incidentNumber: "F-001",
  occurredAt: "2026-08-26T12:00:00Z",
  category: "training",
  fieldNotes: [
    {
      id: "11111111-1111-4111-8111-111111111111",
      text: "Fictional note",
      recordedAt: "2026-08-26T12:00:00Z",
    },
  ],
  reviewedFacts: [],
};
const staffRelationships = [
  {
    staffMemberId: "22222222-2222-4222-8222-222222222222",
    relationship: "reporting_officer" as const,
  },
  {
    staffMemberId: "22222222-2222-4222-8222-222222222222",
    relationship: "preparer" as const,
  },
];

describe("createIncidentCommand", () => {
  it("requires a bounded opaque idempotency key", () => {
    expect(
      createIncidentCommandSchema.safeParse({
        revision,
        staffRelationships,
        idempotencyKey: "short",
      }).success,
    ).toBe(false);
    expect(
      createIncidentCommandSchema.parse({
        revision,
        staffRelationships,
        idempotencyKey: "a".repeat(16),
      }).revision.incidentNumber,
    ).toBe("F-001");
  });

  it("keeps actor and facility authority outside browser command data", () => {
    const command = createIncidentCommandSchema.parse({
      revision,
      staffRelationships,
      idempotencyKey: "a".repeat(16),
    });
    expect(
      toIncidentCreatePersistence({
        actorAccountId: "22222222-2222-4222-8222-222222222222",
        facilityId: "33333333-3333-4333-8333-333333333333",
        command,
      }),
    ).toMatchObject({ incidentNumber: "F-001", revision });
    expect(
      createIncidentCommandSchema.safeParse({ ...command, actorAccountId: "x" })
        .success,
    ).toBe(false);
  });

  it("rejects a confirmed fact scoped to an unselected reporting officer", () => {
    expect(
      createIncidentCommandSchema.safeParse({
        revision: {
          ...revision,
          reviewedFacts: [
            {
              id: "33333333-3333-4333-8333-333333333333",
              field: "Fictional fact",
              state: "confirmed",
              value: "Fictional value",
              sourceNoteIds: [revision.fieldNotes[0].id],
              reportingStaffMemberIds: ["44444444-4444-4444-8444-444444444444"],
            },
          ],
        },
        staffRelationships,
        idempotencyKey: "a".repeat(16),
      }).success,
    ).toBe(false);
  });
});
