import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildProductionBackupEvidence,
  assertDatabaseMetadataUnchanged,
  assertStorageInventoryUnchanged,
  inventoryPrivateStorage,
  normalizeMigrationVersions,
  opaqueObjectFileName,
  productionBackupFreezeWindow,
  validateBackupExpiry,
} from "./create-production-backup.mjs";

describe("Production backup primitives", () => {
  it("writes value-free evidence without the project or encryption recipient", () => {
    const projectRef = "abcdefghijklmnopqrst";
    const ageRecipient =
      "age1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq";
    const evidence = buildProductionBackupEvidence({
      backupId: "backup-20260827T120000000Z-0123456789abcdef",
      projectRef,
      region: "us-east-1",
      approvalReference: "OWNER-BACKUP-APPROVAL-001",
      targetId: "OFF-PROVIDER-TARGET-001",
      ageRecipient,
      database: {
        plaintext: { bytes: 123, sha256: "a".repeat(64) },
        ciphertext: { bytes: 200, sha256: "b".repeat(64) },
      },
      storage: {
        bucket_count: 2,
        object_count: 3,
        plaintext_bytes: 456,
        ciphertext_bytes: 600,
        ciphertext_set_sha256: "c".repeat(64),
      },
      encryptedManifest: { bytes: 700, sha256: "d".repeat(64) },
      tools: { pg_dump: "pg_dump 17", age: "age 1.2", node: "v22" },
      startedAt: "2026-08-27T12:00:00.000Z",
      completedAt: "2026-08-27T12:01:00.000Z",
      expiresOn: "2026-09-03",
    });
    const serialized = JSON.stringify(evidence);
    assert.equal(serialized.includes(projectRef), false);
    assert.equal(serialized.includes(ageRecipient), false);
    assert.equal(serialized.includes("OFF-PROVIDER-TARGET-001"), false);
    assert.equal(evidence.storage.object_count, 3);
  });

  it("uses opaque encrypted filenames that do not disclose bucket or object names", () => {
    const fileName = opaqueObjectFileName(
      "policy-sources",
      "restricted/person-file.pdf",
    );
    assert.match(fileName, /^[a-f0-9]{64}\.age$/u);
    assert.equal(fileName.includes("policy"), false);
    assert.equal(fileName.includes("person"), false);
  });

  it("requires a real future calendar expiry", () => {
    const now = new Date("2026-08-27T12:00:00.000Z");
    assert.equal(validateBackupExpiry("2026-08-28", now), true);
    assert.equal(validateBackupExpiry("2026-08-27", now), true);
    assert.equal(validateBackupExpiry("2026-02-30", now), false);
    assert.equal(validateBackupExpiry("2027-02-30", now), false);
    assert.equal(validateBackupExpiry("2026-08-26", now), false);
    assert.equal(validateBackupExpiry("not-a-date", now), false);
  });

  it("ends backup work before the database freeze expires", () => {
    const now = new Date("2026-08-27T12:00:00.000Z");
    const { deadlineAt, expiresAt } = productionBackupFreezeWindow(now);
    assert.equal(expiresAt.getTime() - now.getTime(), 20 * 60 * 1000);
    assert.equal(expiresAt.getTime() - deadlineAt.getTime(), 30 * 1000);
  });

  it("requires an ordered 14-digit migration history", () => {
    assert.deepEqual(
      normalizeMigrationVersions([
        { version: "20260825125137" },
        { version: "20260827023000" },
      ]),
      { migration_count: 2, migration_head: "20260827023000" },
    );
    assert.throws(
      () => normalizeMigrationVersions([{ version: "bad" }]),
      /migration history is invalid/u,
    );
    assert.throws(
      () =>
        normalizeMigrationVersions([
          { version: "20260827023000" },
          { version: "20260825125137" },
        ]),
      /migration history is invalid/u,
    );
  });

  it("recursively inventories private buckets and sorts them", async () => {
    const pages = new Map([
      ["private-a:", [{ id: null, name: "folder" }]],
      [
        "private-a:folder",
        [
          {
            id: "object-1",
            name: "file.pdf",
            metadata: { size: 12, mimetype: "application/pdf" },
            created_at: "2026-08-27T00:00:00Z",
            updated_at: "2026-08-27T00:00:00Z",
          },
        ],
      ],
      ["private-b:", []],
    ]);
    const storage = {
      async listBuckets() {
        return {
          data: [
            { id: "private-b", name: "private-b", public: false },
            { id: "private-a", name: "private-a", public: false },
          ],
          error: null,
        };
      },
      from(bucket) {
        return {
          async list(prefix) {
            return {
              data: pages.get(`${bucket}:${prefix}`) ?? [],
              error: null,
            };
          },
        };
      },
    };
    const inventory = await inventoryPrivateStorage(storage);
    assert.deepEqual(
      inventory.buckets.map((bucket) => bucket.id),
      ["private-a", "private-b"],
    );
    assert.deepEqual(inventory.objects, [
      {
        id: "object-1",
        bucket: "private-a",
        name: "folder/file.pdf",
        bytes: 12,
        media_type: "application/pdf",
        created_at: "2026-08-27T00:00:00Z",
        updated_at: "2026-08-27T00:00:00Z",
        version: null,
        etag: null,
      },
    ]);
  });

  it("rejects a migration-head change across the database export", () => {
    const before = {
      migration_count: 2,
      migration_head: "20260827062000",
      server_version: "17.4",
    };
    assert.doesNotThrow(() =>
      assertDatabaseMetadataUnchanged(before, { ...before }),
    );
    assert.throws(
      () =>
        assertDatabaseMetadataUnchanged(before, {
          ...before,
          migration_head: "20260827063000",
        }),
      /database changed/u,
    );
  });

  it("rejects object additions, deletions, replacements, and bucket changes", () => {
    const before = {
      buckets: [{ id: "private-a", name: "private-a", public: false }],
      objects: [
        {
          id: "object-1",
          bucket: "private-a",
          name: "file.pdf",
          bytes: 12,
          updated_at: "2026-08-27T00:00:00Z",
        },
      ],
    };
    assert.doesNotThrow(() =>
      assertStorageInventoryUnchanged(before, structuredClone(before)),
    );
    assert.throws(
      () =>
        assertStorageInventoryUnchanged(before, {
          ...before,
          objects: [
            ...before.objects,
            { ...before.objects[0], id: "object-2", name: "new.pdf" },
          ],
        }),
      /Storage changed/u,
    );
    assert.throws(
      () =>
        assertStorageInventoryUnchanged(before, {
          ...before,
          objects: [],
        }),
      /Storage changed/u,
    );
    assert.throws(
      () =>
        assertStorageInventoryUnchanged(before, {
          ...before,
          objects: [
            {
              ...before.objects[0],
              id: "replacement-1",
              updated_at: "2026-08-27T00:01:00Z",
            },
          ],
        }),
      /Storage changed/u,
    );
    assert.throws(
      () =>
        assertStorageInventoryUnchanged(before, {
          ...before,
          buckets: [{ ...before.buckets[0], file_size_limit: 1024 }],
        }),
      /Storage changed/u,
    );
  });

  it("rejects any public Storage bucket", async () => {
    const storage = {
      async listBuckets() {
        return {
          data: [{ id: "public", name: "public", public: true }],
          error: null,
        };
      },
    };
    await assert.rejects(
      () => inventoryPrivateStorage(storage),
      /public bucket exists/u,
    );
  });
});
