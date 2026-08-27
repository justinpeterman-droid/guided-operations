import "server-only";

import { z } from "zod";

import { generatedReportDraftSchema } from "@/features/incidents/generated-report-draft";
import {
  reportTypeSchema,
  type ReportType,
} from "@/features/incidents/report-types";
import {
  authorizeCurrentSession,
  type CurrentSessionClient,
} from "@/server/auth/current-session";

const candidateRowsSchema = z.array(
  z
    .object({
      candidate_id: z.uuid(),
      incident_id: z.uuid(),
      source_incident_revision_id: z.uuid(),
      report_type: reportTypeSchema,
      source_fact_ids: z.array(z.uuid()).min(1).max(300),
      paragraphs: generatedReportDraftSchema.shape.paragraphs,
      created_at: z.iso.datetime({ offset: true }),
    })
    .strict(),
);

type CandidateReadRpcClient = Readonly<{
  rpc(
    functionName: "get_report_draft_candidate",
    arguments_: Readonly<{ p_candidate_id: string }>,
  ): PromiseLike<Readonly<{ data: unknown; error: unknown | null }>>;
}>;

export type GetReportDraftCandidateSessionClient = CurrentSessionClient &
  CandidateReadRpcClient;

export type ReportDraftCandidate = Readonly<{
  candidateId: string;
  incidentId: string;
  sourceIncidentRevisionId: string;
  reportType: ReportType;
  sourceFactIds: readonly string[];
  paragraphs: readonly {
    text: string;
    sourceFactIds: readonly string[];
  }[];
  createdAt: string;
}>;

export type GetReportDraftCandidateResult =
  | Readonly<{ kind: "found"; candidate: ReportDraftCandidate }>
  | Readonly<{ kind: "denied" }>
  | Readonly<{ kind: "not_found" }>
  | Readonly<{ kind: "unavailable" }>;

/** Reads only the review-safe candidate DTO authorized for the current session. */
export async function getReportDraftCandidateForCurrentSession(
  candidateId: unknown,
  client: GetReportDraftCandidateSessionClient,
): Promise<GetReportDraftCandidateResult> {
  const parsedId = z.uuid().safeParse(candidateId);
  if (!parsedId.success) return { kind: "not_found" };

  const session = await authorizeCurrentSession(client);
  if (!session.allowed) return { kind: "denied" };

  try {
    const result = await client.rpc("get_report_draft_candidate", {
      p_candidate_id: parsedId.data,
    });
    if (result.error) return { kind: "unavailable" };
    const rows = candidateRowsSchema.safeParse(result.data);
    if (!rows.success || rows.data.length > 1) return { kind: "unavailable" };
    if (rows.data.length === 0) return { kind: "not_found" };

    const row = rows.data[0];
    return {
      kind: "found",
      candidate: {
        candidateId: row.candidate_id,
        incidentId: row.incident_id,
        sourceIncidentRevisionId: row.source_incident_revision_id,
        reportType: row.report_type,
        sourceFactIds: row.source_fact_ids,
        paragraphs: row.paragraphs,
        createdAt: row.created_at,
      },
    };
  } catch {
    return { kind: "unavailable" };
  }
}
