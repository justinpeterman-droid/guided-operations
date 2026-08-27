import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { verifyPolicyCorpusManifest } from "./verify-policy-corpus-manifest.mjs";

const workspaces = [];
const now = new Date("2026-08-27T12:00:00.000Z");

afterEach(() => {
  for (const workspace of workspaces.splice(0)) {
    rmSync(workspace.root, { recursive: true, force: true });
  }
});

describe("private policy corpus manifest verifier", () => {
  it("returns only value-free aggregate evidence for an approved manifest", async () => {
    const workspace = createWorkspace();
    const evidence = await verify(workspace);
    const serialized = JSON.stringify(evidence);

    assert.equal(evidence.entry_count, 1);
    assert.equal(evidence.current_entry_count, 1);
    assert.equal(evidence.duplicate_byte_group_count, 0);
    assert.equal(serialized.includes("Fictional Use of Force Policy"), false);
    assert.equal(serialized.includes("fictional-policy.pdf"), false);
    assert.equal(serialized.includes("CUSTODIAN-APPROVAL-001"), false);
    assert.equal(serialized.includes("policy-sources"), false);
  });

  it("requires a disjoint private source root outside the repository", async () => {
    const workspace = createWorkspace();
    await assert.rejects(
      () =>
        verifyPolicyCorpusManifest({
          manifestPath: workspace.manifestPath,
          sourceRoot: workspace.root,
          projectRoot: workspace.projectRoot,
          now,
        }),
      /must not contain the repository/u,
    );
  });

  it("rejects source bytes that no longer match the reviewed hash", async () => {
    const workspace = createWorkspace();
    const changed = Buffer.from(workspace.sourceBytes);
    changed[changed.length - 2] ^= 1;
    writeFileSync(workspace.sourcePath, changed);

    await assert.rejects(() => verify(workspace), /SHA-256 does not match/u);
  });

  it("rejects unapproved fields and non-canonical calendar values", async () => {
    const workspace = createWorkspace();
    workspace.manifest.entries[0].unreviewed_note = "must not be ignored";
    writeManifest(workspace);
    await assert.rejects(
      () => verify(workspace),
      /fields do not match the approved manifest schema/u,
    );

    delete workspace.manifest.entries[0].unreviewed_note;
    workspace.manifest.entries[0].effective_on = "2026-02-30";
    writeManifest(workspace);
    await assert.rejects(() => verify(workspace), /real calendar date/u);
  });

  it("requires malware and file checks to bind to the exact source", async () => {
    const workspace = createWorkspace();
    workspace.manifest.entries[0].malware_scan.source_sha256 = "f".repeat(64);
    writeManifest(workspace);

    await assert.rejects(
      () => verify(workspace),
      /not bound to the reviewed source bytes/u,
    );
  });

  it("accepts one complete linear version chain for a policy document", async () => {
    const workspace = createWorkspace();
    const current = workspace.manifest.entries[0];
    const prior = addSourceEntry(workspace, {
      documentId: current.document_id,
      versionId: "22222222-2222-4222-8222-222222222222",
      sourceFile: "fictional-policy-prior.pdf",
      sourceBytes: Buffer.from("%PDF-1.7\nFictional prior revision\n%%EOF\n"),
      versionLabel: "revision-0",
      effectiveOn: "2025-01-01",
      isCurrent: false,
      lifecycleStatus: "superseded",
    });
    current.supersedes_document_version_id = prior.document_version_id;
    writeManifest(workspace);

    const evidence = await verify(workspace);
    assert.equal(evidence.entry_count, 2);
    assert.equal(evidence.current_entry_count, 1);
    assert.equal(evidence.active_entry_count, 1);
  });

  it("rejects disconnected or mismatched version families", async () => {
    const workspace = createWorkspace();
    const current = workspace.manifest.entries[0];
    addSourceEntry(workspace, {
      documentId: current.document_id,
      versionId: "22222222-2222-4222-8222-222222222222",
      sourceFile: "fictional-policy-prior.pdf",
      sourceBytes: Buffer.from("%PDF-1.7\nFictional prior revision\n%%EOF\n"),
      versionLabel: "revision-0",
      effectiveOn: "2025-01-01",
      isCurrent: false,
      lifecycleStatus: "superseded",
    });
    writeManifest(workspace);

    await assert.rejects(() => verify(workspace), /one current version chain/u);
  });

  it("requires one shared approval for intentionally duplicated bytes", async () => {
    const workspace = createWorkspace();
    const first = workspace.manifest.entries[0];
    const duplicate = addSourceEntry(workspace, {
      documentId: "33333333-3333-4333-8333-333333333333",
      versionId: "44444444-4444-4444-8444-444444444444",
      stableKey: "fictional_duplicate_policy",
      title: "Fictional Duplicate Policy",
      sourceFile: "fictional-duplicate.pdf",
      sourceBytes: workspace.sourceBytes,
      versionLabel: "revision-1",
      effectiveOn: "2026-01-01",
      isCurrent: true,
      lifecycleStatus: "active",
    });
    writeManifest(workspace);
    await assert.rejects(
      () => verify(workspace),
      /Duplicate source bytes require/u,
    );

    first.duplicate_bytes_approval_ref = "DUPLICATE-BYTES-APPROVAL-001";
    duplicate.duplicate_bytes_approval_ref = "DUPLICATE-BYTES-APPROVAL-001";
    writeManifest(workspace);
    const evidence = await verify(workspace);
    assert.equal(evidence.duplicate_byte_group_count, 1);
  });

  it("runs as a value-free CLI and redacts private path failures", () => {
    const workspace = createWorkspace();
    const outputPath = join(workspace.privateRoot, "evidence.json");
    const scriptPath = fileURLToPath(
      new URL("./verify-policy-corpus-manifest.mjs", import.meta.url),
    );
    const success = spawnSync(
      process.execPath,
      [
        scriptPath,
        "--manifest",
        workspace.manifestPath,
        "--source-root",
        workspace.sourceRoot,
        "--output",
        outputPath,
      ],
      { encoding: "utf8" },
    );
    assert.equal(success.status, 0, success.stderr);
    assert.equal(success.stdout.trim(), "Policy corpus verification passed.");
    const evidence = readFileSync(outputPath, "utf8");
    assert.equal(evidence.includes("fictional-policy.pdf"), false);
    assert.equal(evidence.includes("Fictional Use of Force Policy"), false);

    const privateMissingPath = join(
      workspace.privateRoot,
      "private-sensitive-manifest-name.json",
    );
    const failure = spawnSync(
      process.execPath,
      [
        scriptPath,
        "--manifest",
        privateMissingPath,
        "--source-root",
        workspace.sourceRoot,
      ],
      { encoding: "utf8" },
    );
    assert.equal(failure.status, 1);
    assert.equal(failure.stderr.includes("private-sensitive"), false);
    assert.match(failure.stderr, /could not be resolved/u);
  });
});

function createWorkspace() {
  const root = mkdtempSync(join(tmpdir(), "guided-corpus-verifier-"));
  const projectRoot = join(root, "repository");
  const privateRoot = join(root, "private");
  const sourceRoot = join(privateRoot, "sources");
  mkdirSync(projectRoot);
  mkdirSync(privateRoot);
  mkdirSync(sourceRoot);
  const sourceBytes = Buffer.from(
    "%PDF-1.7\nFictional policy qualification document\n%%EOF\n",
  );
  const sourcePath = join(sourceRoot, "fictional-policy.pdf");
  writeFileSync(sourcePath, sourceBytes);
  const entry = buildEntry({
    documentId: "11111111-1111-4111-8111-111111111111",
    versionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    stableKey: "fictional_use_of_force",
    title: "Fictional Use of Force Policy",
    sourceFile: "fictional-policy.pdf",
    sourceBytes,
    versionLabel: "revision-1",
    effectiveOn: "2026-01-01",
    isCurrent: true,
    lifecycleStatus: "active",
  });
  const manifest = {
    manifest_version: 1,
    corpus_version: "corpus-v1",
    storage_bucket_alias: "policy-sources",
    custodian_approval_ref: "CUSTODIAN-APPROVAL-001",
    rights_review_approval_ref: "RIGHTS-REVIEW-APPROVAL-001",
    generated_at_utc: "2026-08-27T06:00:00Z",
    entries: [entry],
  };
  const manifestPath = join(privateRoot, "manifest.json");
  const workspace = {
    root,
    projectRoot,
    privateRoot,
    sourceRoot,
    sourcePath,
    sourceBytes,
    manifestPath,
    manifest,
  };
  writeManifest(workspace);
  workspaces.push(workspace);
  return workspace;
}

function addSourceEntry(workspace, options) {
  const sourcePath = join(workspace.sourceRoot, options.sourceFile);
  writeFileSync(sourcePath, options.sourceBytes);
  const entry = buildEntry(options);
  workspace.manifest.entries.push(entry);
  return entry;
}

function buildEntry({
  documentId,
  versionId,
  stableKey = "fictional_use_of_force",
  title = "Fictional Use of Force Policy",
  sourceFile,
  sourceBytes,
  versionLabel,
  effectiveOn,
  isCurrent,
  lifecycleStatus,
}) {
  const sourceSha256 = sha256(sourceBytes);
  const byteSize = sourceBytes.length;
  return {
    document_id: documentId,
    document_version_id: versionId,
    stable_key: stableKey,
    title,
    version_label: versionLabel,
    effective_on: effectiveOn,
    source_file: sourceFile,
    source_sha256: sourceSha256,
    byte_size: byteSize,
    mime_type: "application/pdf",
    page_count: 1,
    classification: "restricted",
    rights_status: "approved_full_reader",
    rights_evidence_ref: "RIGHTS-EVIDENCE-001",
    rights_reviewed_at_utc: "2026-08-27T04:00:00Z",
    rights_review_due_at_utc: "2027-08-27T09:00:00Z",
    allowed_processing_regions: ["us-east-1"],
    external_ai_allowed: true,
    lifecycle_status: lifecycleStatus,
    is_current: isCurrent,
    supersedes_document_version_id: null,
    duplicate_bytes_approval_ref: null,
    malware_scan: {
      status: "passed",
      tool_alias: "fictional-malware-scanner",
      tool_version: "version-1",
      completed_at_utc: "2026-08-27T05:00:00Z",
      source_sha256: sourceSha256,
      byte_size: byteSize,
    },
    file_validation: {
      status: "passed",
      tool_alias: "fictional-pdf-validator",
      tool_version: "version-1",
      completed_at_utc: "2026-08-27T05:15:00Z",
      source_sha256: sourceSha256,
      byte_size: byteSize,
      detected_mime_type: "application/pdf",
      page_count: 1,
    },
    storage_bucket_alias: "policy-sources",
    storage_object_key: `${documentId}/${sourceSha256}.pdf`,
  };
}

function writeManifest(workspace) {
  writeFileSync(
    workspace.manifestPath,
    `${JSON.stringify(workspace.manifest, null, 2)}\n`,
  );
}

function verify(workspace) {
  return verifyPolicyCorpusManifest({
    manifestPath: workspace.manifestPath,
    sourceRoot: workspace.sourceRoot,
    projectRoot: workspace.projectRoot,
    now,
  });
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}
