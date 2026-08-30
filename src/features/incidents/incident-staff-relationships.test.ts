import { describe, expect, it } from "vitest";

import { incidentStaffRelationshipsSchema } from "./incident-staff-relationships";

const reporter = "11111111-1111-4111-8111-111111111111";
const preparer = "22222222-2222-4222-8222-222222222222";

describe("incidentStaffRelationshipsSchema", () => {
  it("accepts distinct reporting and preparing officers", () => {
    expect(
      incidentStaffRelationshipsSchema.parse([
        { staffMemberId: reporter, relationship: "reporting_officer" },
        { staffMemberId: preparer, relationship: "preparer" },
      ]),
    ).toHaveLength(2);
  });

  it("allows one employee to be both reporter and preparer", () => {
    expect(
      incidentStaffRelationshipsSchema.safeParse([
        { staffMemberId: reporter, relationship: "reporting_officer" },
        { staffMemberId: reporter, relationship: "preparer" },
      ]).success,
    ).toBe(true);
  });

  it.each([
    [[{ staffMemberId: preparer, relationship: "preparer" }]],
    [
      [
        { staffMemberId: reporter, relationship: "reporting_officer" },
        { staffMemberId: preparer, relationship: "preparer" },
        { staffMemberId: preparer, relationship: "preparer" },
      ],
    ],
    [
      [
        { staffMemberId: reporter, relationship: "reporting_officer" },
        { staffMemberId: preparer, relationship: "supervisor" },
      ],
    ],
  ])("rejects an incomplete or uncontrolled relationship set", (value) => {
    expect(incidentStaffRelationshipsSchema.safeParse(value).success).toBe(
      false,
    );
  });
});
