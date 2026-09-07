import assert from "node:assert/strict";
import { it } from "node:test";
import {
  parseArguments,
  runEmbedding,
  summarize,
} from "./embed-policy-corpus.mjs";
const id = "11111111-1111-4111-8111-111111111111";
it("defaults to dry-run and requires explicit production confirmation", () => {
  assert.equal(parseArguments([]).apply, false);
  assert.throws(() => parseArguments(["--apply"]));
  assert.equal(
    parseArguments(["--apply", "--confirm-production-embedding"]).apply,
    true,
  );
  for (const args of [
    ["--limit"],
    ["--limit", "-1"],
    ["--limit", "abc"],
    ["extra"],
  ])
    assert.throws(() => parseArguments(args));
});
it("passes dry-run to the guarded CLI without a shell", () => {
  let call;
  const result = runEmbedding(id, false, (...args) => {
    call = args;
    return {
      status: 0,
      stdout: '{"eligible":3,"remaining":3,"embedded":0,"skipped_existing":0}',
      stderr: "uv environment ready",
    };
  });
  assert.equal(result.status, "completed");
  assert.ok(call[1].includes("--dry-run"));
  assert.equal(call[2].shell, false);
  assert.ok(call[1].includes("--confirm-controlled-production-embedding"));
});
it("rejects unsafe version identifiers before spawning", () => {
  const result = runEmbedding("bad&command", true, () => {
    throw Error("must not spawn");
  });
  assert.equal(result.status, "failed");
});
it("redacts provider failures and rejects malformed numeric summaries", () => {
  for (const response of [
    { status: 1, stderr: "PRIVATE TOKEN" },
    { status: 0, stdout: "{}" },
    { status: 0, stdout: '{"embedded":"PRIVATE TOKEN"}' },
  ]) {
    const result = runEmbedding(id, true, () => response);
    assert.equal(result.status, "failed");
    assert.equal(JSON.stringify(result).includes("PRIVATE TOKEN"), false);
  }
});
it("summarizes only completed work", () => {
  assert.deepEqual(
    summarize([{ status: "completed", embedded: 2 }, { status: "failed" }]),
    { total: 2, completed: 1, failed: 1, chunks: 2 },
  );
});
