import "server-only";

import { z } from "zod";

import type {
  PolicyRetrievalProvider,
  PolicyRetrievalRequest,
  RetrievedPolicyPassage,
} from "./contracts";

const rowsSchema = z
  .array(
    z
      .object({
        document_id: z.uuid(),
        document_version_id: z.uuid(),
        chunk_id: z.uuid(),
        stable_key: z.string().min(2).max(128),
        title: z.string().min(1).max(300),
        version_label: z.string().min(1).max(120),
        source_sha256: z.string().regex(/^[a-f0-9]{64}$/),
        page_start: z.number().int().positive().nullable(),
        page_end: z.number().int().positive().nullable(),
        section_path: z.string().min(1).max(300).nullable(),
        excerpt: z.string().min(1).max(1200),
        relevance_score: z.number().finite().nonnegative(),
      })
      .strict(),
  )
  .max(12);

export type PolicyRetrievalRpcClient = Readonly<{
  rpc(
    functionName: "retrieve_policy_passages_v2",
    arguments_: Readonly<{
      p_question: string;
      p_limit?: number;
      p_approved_document_version_ids?: string[];
    }>,
  ): PromiseLike<Readonly<{ data: unknown; error: unknown | null }>>;
}>;

/**
 * Retrieves only the active session's approved and indexed policy passages.
 * The database function owns account/facility authorization; this adapter
 * treats provider errors and malformed rows as unavailable, never evidence.
 */
export function createSupabasePolicyRetrievalProvider(
  client: PolicyRetrievalRpcClient,
): PolicyRetrievalProvider {
  return {
    providerKey: "supabase-lexical-v1",
    async retrieve(
      request: PolicyRetrievalRequest,
    ): Promise<RetrievedPolicyPassage[]> {
      try {
        const result = await client.rpc("retrieve_policy_passages_v2", {
          p_question: request.question,
          p_limit: request.maximumPassages,
          ...(request.approvedDocumentVersionIds?.length
            ? {
                p_approved_document_version_ids: [
                  ...request.approvedDocumentVersionIds,
                ],
              }
            : {}),
        });
        if (result.error) return [];

        const parsed = rowsSchema.safeParse(result.data);
        if (!parsed.success || parsed.data.length > request.maximumPassages) {
          return [];
        }

        return parsed.data.map((row) => ({
          citation: {
            documentId: row.document_id,
            documentVersionId: row.document_version_id,
            chunkId: row.chunk_id,
            stableKey: row.stable_key,
            title: row.title,
            versionLabel: row.version_label,
            sourceSha256: row.source_sha256,
            pageStart: row.page_start,
            pageEnd: row.page_end,
            sectionPath: row.section_path,
            excerpt: row.excerpt,
          },
          relevanceScore: row.relevance_score,
        }));
      } catch {
        return [];
      }
    },
  };
}
