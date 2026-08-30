import "server-only";

import { createHash } from "node:crypto";

import { z } from "zod";

const MAX_POLICY_SOURCE_BYTES = 50 * 1024 * 1024;

const policySourceRowsSchema = z
  .array(
    z
      .object({
        document_id: z.uuid(),
        document_version_id: z.uuid(),
        stable_key: z
          .string()
          .min(2)
          .max(128)
          .regex(/^[A-Za-z0-9][A-Za-z0-9._-]+$/),
        title: z.string().min(1).max(300),
        version_label: z.string().min(1).max(120),
        source_sha256: z.string().regex(/^[a-f0-9]{64}$/),
        storage_bucket: z.literal("policy-sources"),
        storage_path: z.string().min(70).max(200),
        media_type: z.literal("application/pdf"),
        byte_size: z.number().int().min(5).max(MAX_POLICY_SOURCE_BYTES),
        page_count: z.number().int().positive(),
        lifecycle_status: z.enum(["active", "superseded"]),
        is_current: z.boolean(),
        effective_on: z.iso.date().nullable(),
      })
      .strict(),
  )
  .max(1);

export type PolicySourceReaderRpcClient = Readonly<{
  rpc(
    functionName: "get_policy_source_reader",
    arguments_: Readonly<{ p_document_version_id: string }>,
  ): PromiseLike<Readonly<{ data: unknown; error: unknown | null }>>;
}>;

export type AuthorizedPolicySource = Readonly<{
  documentId: string;
  documentVersionId: string;
  stableKey: string;
  title: string;
  versionLabel: string;
  sourceSha256: string;
  storageBucket: "policy-sources";
  storagePath: string;
  mediaType: "application/pdf";
  byteSize: number;
  pageCount: number;
  lifecycleStatus: "active" | "superseded";
  isCurrent: boolean;
  effectiveOn: string | null;
}>;

export type PolicySourceStorageReader = Readonly<{
  download(
    bucket: "policy-sources",
    path: string,
  ): Promise<Readonly<{ data: Blob | null; error: unknown | null }>>;
}>;

export type PolicySourceReadResult =
  | Readonly<{ kind: "ready"; pdf: ArrayBuffer; filename: string }>
  | Readonly<{ kind: "storage_unavailable" }>
  | Readonly<{ kind: "integrity_failure" }>;

/**
 * Loads one exact document version through the session-bound authorization RPC.
 * Any provider error, malformed row, or path mismatch is denied as unavailable.
 */
export async function getAuthorizedPolicySource(
  client: PolicySourceReaderRpcClient,
  documentVersionId: string,
): Promise<AuthorizedPolicySource | null> {
  if (!z.uuid().safeParse(documentVersionId).success) return null;

  try {
    const result = await client.rpc("get_policy_source_reader", {
      p_document_version_id: documentVersionId,
    });
    if (result.error) return null;

    const parsed = policySourceRowsSchema.safeParse(result.data);
    if (!parsed.success || parsed.data.length !== 1) return null;

    const row = parsed.data[0];
    const expectedPath = `${row.document_id}/${row.source_sha256}.pdf`;
    if (
      row.document_version_id !== documentVersionId ||
      row.storage_path !== expectedPath ||
      (row.is_current && row.lifecycle_status !== "active") ||
      (!row.is_current && row.lifecycle_status !== "superseded")
    ) {
      return null;
    }

    return {
      documentId: row.document_id,
      documentVersionId: row.document_version_id,
      stableKey: row.stable_key,
      title: row.title,
      versionLabel: row.version_label,
      sourceSha256: row.source_sha256,
      storageBucket: row.storage_bucket,
      storagePath: row.storage_path,
      mediaType: row.media_type,
      byteSize: row.byte_size,
      pageCount: row.page_count,
      lifecycleStatus: row.lifecycle_status,
      isCurrent: row.is_current,
      effectiveOn: row.effective_on,
    };
  } catch {
    return null;
  }
}

/**
 * Downloads only the previously authorized immutable object and rechecks its
 * type, size, PDF signature, and SHA-256 before any bytes reach the browser.
 */
export async function readAuthorizedPolicySourcePdf(
  source: AuthorizedPolicySource,
  storage: PolicySourceStorageReader,
): Promise<PolicySourceReadResult> {
  const expectedPath = `${source.documentId}/${source.sourceSha256}.pdf`;
  if (
    source.storageBucket !== "policy-sources" ||
    source.storagePath !== expectedPath ||
    source.mediaType !== "application/pdf" ||
    source.byteSize < 5 ||
    source.byteSize > MAX_POLICY_SOURCE_BYTES
  ) {
    return { kind: "integrity_failure" };
  }

  try {
    const result = await storage.download(
      source.storageBucket,
      source.storagePath,
    );
    if (result.error || !(result.data instanceof Blob)) {
      return { kind: "storage_unavailable" };
    }

    if (
      result.data.size !== source.byteSize ||
      result.data.type.toLowerCase() !== source.mediaType
    ) {
      return { kind: "integrity_failure" };
    }

    const pdf = await result.data.arrayBuffer();
    const bytes = new Uint8Array(pdf);
    if (
      bytes.length < 5 ||
      String.fromCharCode(...bytes.subarray(0, 5)) !== "%PDF-"
    ) {
      return { kind: "integrity_failure" };
    }

    const digest = createHash("sha256").update(bytes).digest("hex");
    if (digest !== source.sourceSha256) {
      return { kind: "integrity_failure" };
    }

    return {
      kind: "ready",
      pdf,
      filename: `${source.stableKey}-${source.sourceSha256.slice(0, 12)}.pdf`,
    };
  } catch {
    return { kind: "storage_unavailable" };
  }
}
