import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { evaluateFictionalDevelopmentSnapshot } from "./verify-fictional-development-data.mjs";

function validSnapshot(overrides = {}) {
  return {
    applicationTableCounts: {
      facilities: 1,
      staff_members: 1,
      user_accounts: 1,
      auth_attempt_events: 84,
      audit_events: 17,
      incidents: 0,
      reports: 0,
      paperwork_records: 0,
      policy_documents: 0,
      policy_document_versions: 0,
      policy_pages: 0,
      policy_chunks: 0,
      policy_chunk_embeddings: 0,
    },
    fixtureMatches: 1,
    authUserCount: 1,
    fixtureAuthMatches: 1,
    storageBucketCount: 2,
    expectedPrivateBucketCount: 2,
    storageObjectCount: 0,
    ...overrides,
  };
}

describe("fictional Development data-boundary verifier", () => {
  it("returns only aggregate evidence for the exact fictional fixture", () => {
    assert.deepEqual(evaluateFictionalDevelopmentSnapshot(validSnapshot()), {
      status: "verified",
      applicationTableCount: 13,
      fictionalFixtureAccounts: 1,
      operationalRows: 0,
      metadataRows: 101,
      privateStorageBuckets: 2,
      storageObjects: 0,
    });
  });

  it("rejects unexpected identity, operational, and Storage data", () => {
    assert.throws(() =>
      evaluateFictionalDevelopmentSnapshot(
        validSnapshot({ fixtureMatches: 0 }),
      ),
    );
    assert.throws(() =>
      evaluateFictionalDevelopmentSnapshot(
        validSnapshot({
          applicationTableCounts: {
            ...validSnapshot().applicationTableCounts,
            incidents: 1,
          },
        }),
      ),
    );
    assert.throws(() =>
      evaluateFictionalDevelopmentSnapshot(
        validSnapshot({ storageObjectCount: 1 }),
      ),
    );
  });
});
