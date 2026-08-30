import { z } from "zod";

export const INCIDENT_STAFF_RELATIONSHIPS = [
  "reporting_officer",
  "preparer",
  "involved_officer",
  "witness",
] as const;

export const incidentStaffRelationshipTypeSchema = z.enum(
  INCIDENT_STAFF_RELATIONSHIPS,
);

export type IncidentStaffRelationshipType = z.infer<
  typeof incidentStaffRelationshipTypeSchema
>;

export const INCIDENT_STAFF_RELATIONSHIP_LABELS = {
  reporting_officer: "Reporting officer",
  preparer: "Preparing officer",
  involved_officer: "Involved officer",
  witness: "Witness",
} as const satisfies Record<IncidentStaffRelationshipType, string>;

export const incidentStaffRelationshipSchema = z
  .object({
    staffMemberId: z.uuid(),
    relationship: incidentStaffRelationshipTypeSchema,
  })
  .strict();

export const incidentStaffRelationshipsSchema = z
  .array(incidentStaffRelationshipSchema)
  .min(2)
  .max(61)
  .superRefine((relationships, context) => {
    const uniquePairs = new Set(
      relationships.map(
        (relationship) =>
          `${relationship.staffMemberId}:${relationship.relationship}`,
      ),
    );
    if (uniquePairs.size !== relationships.length) {
      context.addIssue({
        code: "custom",
        message: "Officer relationships must be unique.",
      });
    }

    const reportingOfficerCount = relationships.filter(
      ({ relationship }) => relationship === "reporting_officer",
    ).length;
    if (reportingOfficerCount < 1 || reportingOfficerCount > 20) {
      context.addIssue({
        code: "custom",
        message: "Select between one and twenty reporting officers.",
      });
    }

    const preparerCount = relationships.filter(
      ({ relationship }) => relationship === "preparer",
    ).length;
    if (preparerCount !== 1) {
      context.addIssue({
        code: "custom",
        message: "Select exactly one preparing officer.",
      });
    }
  });

export type IncidentStaffRelationship = z.infer<
  typeof incidentStaffRelationshipSchema
>;
