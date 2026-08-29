import "server-only";

import { z } from "zod";

import { policyCollectionSchema } from "@/features/policy/grounding";

import type {
  PolicyQueryEmbeddingProvider,
  PolicyRetrievalProvider,
  PolicyRetrievalRequest,
  RetrievedPolicyPassage,
} from "./contracts";
import { AiBudgetCircuitOpenError } from "./ai-request-budget";

const rowSchema = z
  .object({
    document_id: z.uuid(),
    document_version_id: z.uuid(),
    chunk_id: z.uuid(),
    stable_key: z.string().min(2).max(128),
    title: z.string().min(1).max(300),
    version_label: z.string().min(1).max(120),
    source_sha256: z.string().regex(/^[a-f0-9]{64}$/),
    collection: policyCollectionSchema,
    page_start: z.number().int().positive().nullable(),
    page_end: z.number().int().positive().nullable(),
    section_path: z.string().min(1).max(300).nullable(),
    excerpt: z.string().min(1).max(1200),
    relevance_score: z.number().finite().nonnegative(),
    lexical_rank: z.number().int().positive().nullable(),
    semantic_rank: z.number().int().positive().nullable(),
  })
  .strict()
  .refine((row) => row.lexical_rank !== null || row.semantic_rank !== null);

const rowsSchema = z.array(rowSchema).max(12);

const queryEmbeddingSchema = z
  .object({
    profileKey: z.string().regex(/^[a-z0-9][a-z0-9._-]{1,127}$/),
    dimensions: z.number().int().min(1).max(16_000),
    values: z.array(z.number().finite()).min(1).max(16_000),
  })
  .strict()
  .refine((embedding) => embedding.values.length === embedding.dimensions)
  .refine((embedding) => embedding.values.some((value) => value !== 0));

export type PolicyRetrievalRpcClient = Readonly<{
  rpc(
    functionName: "retrieve_policy_passages_v4",
    arguments_: Readonly<{
      p_question: string;
      p_query_embedding: string;
      p_embedding_profile_key: string;
      p_limit?: number;
      p_approved_document_version_ids?: string[];
      p_collections?: string[];
    }>,
  ): PromiseLike<Readonly<{ data: unknown; error: unknown | null }>>;
}>;

export class PolicyRetrievalUnavailableError extends Error {
  constructor() {
    super("Policy retrieval is unavailable");
    this.name = "PolicyRetrievalUnavailableError";
  }
}

/**
 * Retrieves deterministic lexical/semantic fusion results from the active
 * session's authorized corpus. Provider and RPC failures are surfaced as
 * unavailable rather than being mislabeled as insufficient evidence.
 */
export function createSupabasePolicyRetrievalProvider(
  client: PolicyRetrievalRpcClient,
  queryEmbeddingProvider: PolicyQueryEmbeddingProvider,
): PolicyRetrievalProvider {
  return {
    providerKey: "supabase-hybrid-rrf-v1",
    async retrieve(
      request: PolicyRetrievalRequest,
    ): Promise<RetrievedPolicyPassage[]> {
      try {
        if (
          request.maximumPassages < 1 ||
          request.maximumPassages > 12 ||
          request.approvedDocumentVersionIds?.length === 0 ||
          request.collections?.length === 0
        ) {
          throw new PolicyRetrievalUnavailableError();
        }

        const queryEmbedding = queryEmbeddingSchema.parse(
          await queryEmbeddingProvider.embedQuestion(request.question),
        );
        const result = await client.rpc("retrieve_policy_passages_v4", {
          p_question: request.question,
          p_query_embedding: JSON.stringify(queryEmbedding.values),
          p_embedding_profile_key: queryEmbedding.profileKey,
          p_limit: request.maximumPassages,
          ...(request.approvedDocumentVersionIds
            ? {
                p_approved_document_version_ids: [
                  ...request.approvedDocumentVersionIds,
                ],
              }
            : {}),
          ...(request.collections
            ? { p_collections: [...request.collections] }
            : {}),
        });
        if (result.error) throw new PolicyRetrievalUnavailableError();

        const parsed = rowsSchema.safeParse(result.data);
        if (!parsed.success || parsed.data.length > request.maximumPassages) {
          throw new PolicyRetrievalUnavailableError();
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
            collection: row.collection,
            pageStart: row.page_start,
            pageEnd: row.page_end,
            sectionPath: row.section_path,
            excerpt: row.excerpt,
          },
          relevanceScore: row.relevance_score,
        }));
      } catch (error) {
        if (error instanceof AiBudgetCircuitOpenError) throw error;
        if (error instanceof PolicyRetrievalUnavailableError) throw error;
        throw new PolicyRetrievalUnavailableError();
      }
    },
  };
}
