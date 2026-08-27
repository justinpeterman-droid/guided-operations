import "server-only";

import { z } from "zod";

import {
  storedReviewedFactSchema,
  type StoredReviewedFact,
} from "@/features/incidents/schema";
import {
  authorizeCurrentSession,
  type CurrentSessionClient,
} from "@/server/auth/current-session";

const reportingOfficerSchema = z
  .object({
    staffMemberId: z.uuid(),
    displayName: z.string().trim().min(1).max(160),
    employeeNumberHint: z.string().trim().min(2).max(8),
    shiftCode: z.enum(["A", "B", "C", "D", "U", "F"]).nullable(),
  })
  .strict();

const workspaceRowSchema = z
  .object({
    incident_id: z.uuid(),
    incident_number: z.string().trim().min(1).max(80),
    display_name: z.string().trim().min(1).max(160),
    category: z.string().trim().min(1).max(100),
    incident_revision_id: z.uuid(),
    revision_number: z.number().int().positive(),
    schema_version: z.union([z.literal(1), z.literal(2)]),
    reviewed_facts: z.array(storedReviewedFactSchema).max(300),
    reporting_officers: z.array(reportingOfficerSchema).max(20),
  })
  .strict()
  .superRefine((row, context) => {
    if (
      row.schema_version === 2 &&
      row.reviewed_facts.some(
        (fact) =>
          fact.state === "confirmed" && !("reportingStaffMemberIds" in fact),
      )
    ) {
      context.addIssue({
        code: "custom",
        message: "Version-two confirmed facts require reporting scope.",
        path: ["reviewed_facts"],
      });
    }
  });

const workspaceRowsSchema = z.array(workspaceRowSchema).max(1);

type IncidentReportWorkspaceRpcClient = Readonly<{
  rpc(
    functionName: "get_incident_report_workspace",
    arguments_: Readonly<{ p_incident_id: string }>,
  ): PromiseLike<Readonly<{ data: unknown; error: unknown | null }>>;
}>;

export type GetIncidentReportWorkspaceSessionClient = CurrentSessionClient &
  IncidentReportWorkspaceRpcClient;

export type ReportingOfficerSelection = z.infer<typeof reportingOfficerSchema>;

export type IncidentReportWorkspace = Readonly<{
  incidentId: string;
  incidentNumber: string;
  displayName: string;
  category: string;
  incidentRevisionId: string;
  revisionNumber: number;
  schemaVersion: 1 | 2;
  reviewedFacts: readonly StoredReviewedFact[];
  reportingOfficers: readonly ReportingOfficerSelection[];
}>;

export type GetIncidentReportWorkspaceResult =
  | Readonly<{ kind: "found"; workspace: IncidentReportWorkspace }>
  | Readonly<{ kind: "denied" }>
  | Readonly<{ kind: "not_found" }>
  | Readonly<{ kind: "unavailable" }>;

/** Loads only the current authorized revision and minimum draft-selection data. */
export async function getIncidentReportWorkspaceForCurrentSession(
  incidentIdCandidate: unknown,
  client: GetIncidentReportWorkspaceSessionClient,
): Promise<GetIncidentReportWorkspaceResult> {
  const incidentId = z.uuid().safeParse(incidentIdCandidate);
  if (!incidentId.success) return { kind: "not_found" };

  const session = await authorizeCurrentSession(client);
  if (!session.allowed) return { kind: "denied" };

  try {
    const result = await client.rpc("get_incident_report_workspace", {
      p_incident_id: incidentId.data,
    });
    if (result.error) return { kind: "unavailable" };

    const rows = workspaceRowsSchema.safeParse(result.data);
    if (!rows.success) return { kind: "unavailable" };
    if (rows.data.length === 0) return { kind: "not_found" };

    const row = rows.data[0];
    return {
      kind: "found",
      workspace: {
        incidentId: row.incident_id,
        incidentNumber: row.incident_number,
        displayName: row.display_name,
        category: row.category,
        incidentRevisionId: row.incident_revision_id,
        revisionNumber: row.revision_number,
        schemaVersion: row.schema_version,
        reviewedFacts: row.reviewed_facts,
        reportingOfficers: row.reporting_officers,
      },
    };
  } catch {
    return { kind: "unavailable" };
  }
}
