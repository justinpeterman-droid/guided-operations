import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyApproval,
  printReport,
  classifyVersion,
  parseArguments,
  summarize,
} from "./approve-policy-corpus.mjs";

/** A version that imported cleanly and is waiting only on owner approval. */
function pendingRow(overrides = {}) {
  return {
    document_id: "11111111-1111-4111-8111-111111111111",
    title: "Fictional training reference",
    stable_key: "fictional-training-reference",
    document_collection: "unit_policies",
    document_status: "draft",
    version_id: "22222222-2222-4222-8222-222222222222",
    approved_at: null,
    indexed_at: null,
    version_lifecycle: "pending",
    is_current: true,
    rights_status: "approved_full_reader",
    external_ai_allowed: true,
    rights_review_due_at: "2027-08-30T00:00:00.000Z",
    version_sha: "a".repeat(64),
    ingestion_run_id: "33333333-3333-4333-8333-333333333333",
    ingestion_status: "awaiting_review",
    ingestion_qa_status: "pending",
    completed_at: "2026-08-30T12:00:00.000Z",
    failure_count: 0,
    recorded_page_count: 6,
    recorded_chunk_count: 5,
    ingestion_collection: "unit_policies",
    ingestion_sha: "a".repeat(64),
    rejected_pages: 0,
    blocked_chunks: 0,
    pages_total: 6,
    pages_approved: 0,
    chunks_total: 5,
    chunks_approved: 0,
    ...overrides,
  };
}

const NOW = new Date("2026-09-03T00:00:00.000Z");

describe("approval argument parsing", () => {
  it("defaults to a read-only dry run", () => {
    const options = parseArguments([]);
    assert.equal(options.apply, false);
    assert.equal(options.confirmed, false);
  });

  it("reads the reviewer and the two write flags", () => {
    const options = parseArguments([
      "--reviewer-id",
      "11111111-1111-4111-8111-111111111111",
      "--apply",
      "--confirm-production-corpus-approval",
    ]);
    assert.equal(options.reviewerId, "11111111-1111-4111-8111-111111111111");
    assert.equal(options.apply, true);
    assert.equal(options.confirmed, true);
  });

  it("rejects an unknown option rather than ignoring it", () => {
    assert.throws(() => parseArguments(["--approve-everything"]));
  });
});

describe("approval classification", () => {
  it("approves a clean pending version and lists every change", () => {
    const result = classifyVersion(pendingRow(), NOW);
    assert.equal(result.verdict, "will-approve");
    assert.deepEqual(result.blockers, []);
    assert.ok(result.changes.includes("approve 6 page(s)"));
    assert.ok(result.changes.includes("approve 5 chunk(s)"));
    assert.ok(result.changes.includes("mark the document approved"));
  });

  it("reports a fully approved version as needing nothing", () => {
    const result = classifyVersion(
      pendingRow({
        document_status: "approved",
        version_lifecycle: "active",
        approved_at: "2026-08-30T12:00:00.000Z",
        indexed_at: "2026-08-30T12:00:00.000Z",
        ingestion_status: "ready",
        ingestion_qa_status: "approved",
        pages_approved: 6,
        chunks_approved: 5,
      }),
      NOW,
    );
    assert.equal(result.verdict, "already-approved");
    assert.deepEqual(result.changes, []);
  });

  it("blocks a version whose rights were never cleared", () => {
    const result = classifyVersion(
      pendingRow({ rights_status: "pending" }),
      NOW,
    );
    assert.equal(result.verdict, "blocked");
    assert.deepEqual(result.changes, []);
    assert.ok(result.blockers.some((b) => b.includes("rights_status")));
  });

  it("blocks a version whose rights review has expired", () => {
    const result = classifyVersion(
      pendingRow({ rights_review_due_at: "2026-08-01T00:00:00.000Z" }),
      NOW,
    );
    assert.equal(result.verdict, "blocked");
  });

  it("blocks an import that recorded a failure", () => {
    const result = classifyVersion(pendingRow({ failure_count: 1 }), NOW);
    assert.equal(result.verdict, "blocked");
    assert.ok(result.blockers.some((b) => b.includes("failure")));
  });

  it("blocks when the recorded page count disagrees with stored pages", () => {
    const result = classifyVersion(pendingRow({ pages_total: 5 }), NOW);
    assert.equal(result.verdict, "blocked");
    assert.ok(result.blockers.some((b) => b.includes("page_count")));
  });

  it("blocks a version that is no longer current", () => {
    const result = classifyVersion(pendingRow({ is_current: false }), NOW);
    assert.equal(result.verdict, "blocked");
  });

  it("blocks a document that was retired", () => {
    const result = classifyVersion(
      pendingRow({ document_status: "retired" }),
      NOW,
    );
    assert.equal(result.verdict, "blocked");
  });

  it("blocks a quarantined ingestion run", () => {
    const result = classifyVersion(
      pendingRow({ ingestion_status: "quarantined" }),
      NOW,
    );
    assert.equal(result.verdict, "blocked");
  });

  it("blocks an import that never completed", () => {
    const result = classifyVersion(pendingRow({ completed_at: null }), NOW);
    assert.equal(result.verdict, "blocked");
  });

  it("blocks when the ingestion hash does not match the version", () => {
    const result = classifyVersion(
      pendingRow({ ingestion_sha: "b".repeat(64) }),
      NOW,
    );
    assert.equal(result.verdict, "blocked");
  });
});

describe("approval totals", () => {
  it("counts only approvable pages and chunks", () => {
    const rows = [
      pendingRow(),
      pendingRow({ failure_count: 2 }),
      pendingRow({
        document_status: "approved",
        version_lifecycle: "active",
        approved_at: "2026-08-30T12:00:00.000Z",
        indexed_at: "2026-08-30T12:00:00.000Z",
        ingestion_status: "ready",
        ingestion_qa_status: "approved",
        pages_approved: 6,
        chunks_approved: 5,
      }),
    ];
    const totals = summarize(
      rows.map((row) => ({ row, ...classifyVersion(row, NOW) })),
    );
    assert.equal(totals.total, 3);
    assert.equal(totals.willApprove, 1);
    assert.equal(totals.blocked, 1);
    assert.equal(totals.alreadyApproved, 1);
    assert.equal(totals.pages, 6);
    assert.equal(totals.chunks, 5);
  });
});

describe("approval transaction and privacy", () => {
  it("rejects missing values and unintended writes", () => {
    for (const args of [
      ["--reviewer-id"],
      ["--reviewer-id", "bad"],
      ["--apply"],
      ["positional"],
    ])
      assert.throws(() => parseArguments(args));
  });
  it("does not revive rejected evidence", () => {
    for (const change of [
      { version_lifecycle: "rejected" },
      { ingestion_qa_status: "rejected" },
      { rejected_pages: 1 },
      { blocked_chunks: 1 },
    ])
      assert.equal(classifyVersion(pendingRow(change), NOW).verdict, "blocked");
  });
  it("rechecks eligibility after the lock and never updates newly blocked evidence", async () => {
    const calls = [];
    const tx = async (strings) => {
      const query = strings.join("?");
      calls.push(query);
      if (query.startsWith("lock table")) return [];
      if (query.startsWith("select staff.id")) return [{ id: "reviewer" }];
      if (query.includes("select distinct on"))
        return [pendingRow({ is_current: false })];
      return [];
    };
    const count = await applyApproval(
      { begin: async (fn) => fn(tx) },
      "facility",
      {
        apply: true,
        confirmed: true,
        reviewerId: "reviewer",
        documentVersionId: "",
      },
    );
    assert.equal(count, 0);
    assert.ok(
      calls.findIndex((q) => q.startsWith("lock table")) <
        calls.findIndex((q) => q.includes("select distinct on")),
    );
    assert.equal(
      calls.some((q) => q.trim().startsWith("update")),
      false,
    );
  });
  it("refuses an inactive or wrong-facility reviewer before writes", async () => {
    const calls = [];
    const tx = async (strings) => {
      calls.push(strings.join("?"));
      return [];
    };
    await assert.rejects(() =>
      applyApproval({ begin: async (fn) => fn(tx) }, "facility", {
        apply: true,
        confirmed: true,
        reviewerId: "reviewer",
      }),
    );
    assert.equal(
      calls.some(
        (q) =>
          q.includes("select distinct on") || q.trim().startsWith("update"),
      ),
      false,
    );
  });
  it("reports opaque version identifiers without titles or personnel", () => {
    let output = "";
    const write = process.stdout.write;
    process.stdout.write = (chunk) => {
      output += chunk;
      return true;
    };
    try {
      printReport([
        {
          row: pendingRow({ title: "DO NOT LOG TITLE" }),
          ...classifyVersion(pendingRow(), NOW),
        },
      ]);
    } finally {
      process.stdout.write = write;
    }
    assert.equal(output.includes("DO NOT LOG TITLE"), false);
    assert.equal(output.includes("CHOOSE WHO"), false);
    assert.ok(output.includes("22222222-2222-4222-8222-222222222222"));
  });
});
