import { createHash } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  getAuthorizedPolicySource,
  readAuthorizedPolicySourcePdf,
  type AuthorizedPolicySource,
} from "./policy-source-reader";

const pdfBytes = new TextEncoder().encode(
  "%PDF-1.7\nFictional qualification policy.\n%%EOF",
);
const sourceSha256 = createHash("sha256").update(pdfBytes).digest("hex");
const documentId = "11111111-1111-4111-8111-111111111111";
const documentVersionId = "22222222-2222-4222-8222-222222222222";

const row = {
  document_id: documentId,
  document_version_id: documentVersionId,
  stable_key: "fictional-policy-101",
  title: "Fictional Qualification Policy",
  version_label: "training-v1",
  source_sha256: sourceSha256,
  storage_bucket: "policy-sources" as const,
  storage_path: `${documentId}/${sourceSha256}.pdf`,
  media_type: "application/pdf" as const,
  byte_size: pdfBytes.byteLength,
  page_count: 1,
  lifecycle_status: "active" as const,
  is_current: true,
  effective_on: "2026-08-27",
};

function source(overrides: Partial<AuthorizedPolicySource> = {}) {
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
    ...overrides,
  } satisfies AuthorizedPolicySource;
}

describe("authorized policy source reader", () => {
  it("accepts one exact session-authorized content-addressed source", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [row], error: null });

    await expect(
      getAuthorizedPolicySource({ rpc }, documentVersionId),
    ).resolves.toEqual(source());
    expect(rpc).toHaveBeenCalledWith("get_policy_source_reader", {
      p_document_version_id: documentVersionId,
    });
  });

  it("fails closed before or after the RPC for malformed source identity", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ ...row, storage_path: `${documentId}/changed.pdf` }],
      error: null,
    });

    await expect(
      getAuthorizedPolicySource({ rpc }, "not-a-version-id"),
    ).resolves.toBeNull();
    expect(rpc).not.toHaveBeenCalled();

    await expect(
      getAuthorizedPolicySource({ rpc }, documentVersionId),
    ).resolves.toBeNull();
  });

  it("serves only bytes matching the approved PDF size, signature, and hash", async () => {
    const download = vi.fn().mockResolvedValue({
      data: new Blob([pdfBytes], { type: "application/pdf" }),
      error: null,
    });

    await expect(
      readAuthorizedPolicySourcePdf(source(), { download }),
    ).resolves.toMatchObject({
      kind: "ready",
      filename: `fictional-policy-101-${sourceSha256.slice(0, 12)}.pdf`,
    });
    expect(download).toHaveBeenCalledWith("policy-sources", row.storage_path);
  });

  it.each([
    [
      "wrong MIME type",
      new Blob([pdfBytes], { type: "application/octet-stream" }),
    ],
    [
      "wrong byte count",
      new Blob([new Uint8Array([...pdfBytes, 0])], { type: "application/pdf" }),
    ],
    [
      "wrong PDF signature",
      new Blob([new Uint8Array([33, ...pdfBytes.slice(1)])], {
        type: "application/pdf",
      }),
    ],
    [
      "wrong content hash",
      new Blob(
        [new Uint8Array([...pdfBytes.slice(0, -1), pdfBytes.at(-1)! ^ 1])],
        { type: "application/pdf" },
      ),
    ],
  ])("rejects an object with %s", async (_label, pdf) => {
    await expect(
      readAuthorizedPolicySourcePdf(source(), {
        download: vi.fn().mockResolvedValue({ data: pdf, error: null }),
      }),
    ).resolves.toEqual({ kind: "integrity_failure" });
  });

  it("does not expose provider failures as document details", async () => {
    await expect(
      readAuthorizedPolicySourcePdf(source(), {
        download: vi
          .fn()
          .mockResolvedValue({ data: null, error: new Error("fictional") }),
      }),
    ).resolves.toEqual({ kind: "storage_unavailable" });
  });
});
