import assert from "node:assert/strict";
import { it } from "node:test";
import {
  parseArguments,
  createReviewManifest,
  validateReviewedManifest,
  createOperatorClient,
  verifyApprovedOrigin,
  main,
} from "./review-policy-corpus.mjs";

const version = "aaaaaaaa-0000-4000-8000-000000000001";
it("pins operator requests to independently configured production origin", () => {
  const origin = "https://fictional.example.test";
  verifyApprovedOrigin(origin, origin);
  verifyApprovedOrigin(origin, `${origin}/`);
  for (const configured of [
    undefined,
    "",
    "invalid",
    "http://fictional.example.test",
    `${origin}/path`,
    `${origin}?x=1`,
    `${origin}#x`,
    "https://user:password@fictional.example.test",
    "https://localhost",
  ])
    assert.throws(() => verifyApprovedOrigin(origin, configured));
  for (const target of [
    "https://fictional.example.test.attacker.test",
    "https://fictional-example.test",
    `${origin}:444`,
    "https://preview.example.test",
  ])
    assert.throws(() => verifyApprovedOrigin(target, origin));
});
it("rejects an unapproved origin before file reads, credential prompts or network access", async () => {
  const previous = process.env.POLICY_CORPUS_REVIEW_ORIGIN;
  process.env.POLICY_CORPUS_REVIEW_ORIGIN = "https://fictional.example.test";
  try {
    await assert.rejects(
      main([
        "approve",
        "--origin",
        "https://attacker.example.test",
        "--manifest",
        "missing.json",
        "--source",
        "missing.pdf",
        "--review-record",
        "missing-review.json",
        "--confirm-reviewed-version",
      ]),
      /Operator origin does not match/,
    );
  } finally {
    if (previous === undefined) delete process.env.POLICY_CORPUS_REVIEW_ORIGIN;
    else process.env.POLICY_CORPUS_REVIEW_ORIGIN = previous;
  }
});
const snapshot = {
  protocol: "policy-full-review-v1",
  versionId: version,
  runId: version,
  sourceSha256: "a".repeat(64),
  registrySha256: "b".repeat(64),
  pages: [
    { page: 1, textSha256: "c".repeat(64), evidenceSha256: "c".repeat(64) },
  ],
  chunks: [
    {
      id: version,
      ordinal: 0,
      pageStart: 1,
      pageEnd: 1,
      textSha256: "d".repeat(64),
      evidenceSha256: "d".repeat(64),
    },
  ],
};
it("requires exact scope and rejects approval shortcuts and credential arguments", () => {
  const args = [
    "prepare",
    "--origin",
    "https://fictional.example.test",
    "--document-version",
    version,
    "--ingestion-run",
    version,
    "--output",
    "private.json",
  ];
  assert.equal(parseArguments(args).action, "prepare");
  for (const flag of [
    "--reviewer-id",
    "--all",
    "--passcode",
    "--activate",
    "--origin",
  ])
    assert.throws(() => parseArguments([...args, flag, "untrusted"]));
  assert.throws(() =>
    parseArguments(
      args.map((x) =>
        x === "https://fictional.example.test"
          ? "http://fictional.example.test"
          : x,
      ),
    ),
  );
  assert.throws(() =>
    parseArguments([
      "approve",
      "--origin",
      "https://fictional.example.test",
      "--manifest",
      "m.json",
      "--source",
      "s.pdf",
      "--review-record",
      "r.json",
    ]),
  );
});
it("preparation cannot create review decisions or copy unapproved response fields", () => {
  const manifest = createReviewManifest({
    ...snapshot,
    sourceText: "Fictional secret-like content",
  });
  assert.equal(manifest.sourceReviewed, false);
  assert.ok(manifest.pages.every((p) => p.reviewed === false));
  assert.ok(manifest.chunks.every((c) => c.reviewed === false));
  assert.ok(!JSON.stringify(manifest).includes("Fictional secret-like"));
  assert.throws(() => validateReviewedManifest(manifest));
  manifest.sourceReviewed = true;
  manifest.reviewRecordSha256 = "e".repeat(64);
  manifest.pages[0].reviewed = true;
  assert.throws(() => validateReviewedManifest(manifest));
  manifest.chunks[0].reviewed = true;
  assert.equal(validateReviewedManifest(manifest), manifest);
  assert.throws(() =>
    validateReviewedManifest({ ...manifest, actor: version }),
  );
  assert.throws(() =>
    validateReviewedManifest({
      ...manifest,
      pages: [{ ...manifest.pages[0], narrative: "fictional" }],
    }),
  );
});
it("keeps cookies in memory and sends origin/CSRF only to fixed same-origin endpoints", async () => {
  const calls = [];
  const client = createOperatorClient(
    "https://fictional.example.test",
    async (url, options) => {
      calls.push({ url, options });
      return new Response(
        JSON.stringify(
          url.endsWith("csrf")
            ? { csrfToken: "fictional-csrf" }
            : { status: "signed_in" },
        ),
        {
          headers: {
            "set-cookie": "session=fictional-cookie; Secure; HttpOnly",
          },
        },
      );
    },
  );
  await client.request("/api/auth/sign-in", {
    employeeNumber: "FICT-01",
    passcode: "FictionalPasscode!",
  });
  await client.request("/api/auth/csrf");
  await client.request("/api/admin/policy-review", { action: "prepare" });
  assert.equal(calls[2].options.headers.Cookie, "session=fictional-cookie");
  assert.equal(calls[2].options.headers["x-csrf-token"], "fictional-csrf");
  assert.equal(
    calls[2].options.headers.Origin,
    "https://fictional.example.test",
  );
  assert.equal(calls[2].options.redirect, "error");
  await assert.rejects(client.request("https://untrusted.example.test/"));
  client.clear();
  await client.request("/api/auth/csrf");
  assert.equal(calls[3].options.headers.Cookie, "");
});
it("does not expose raw provider errors", async () => {
  const client = createOperatorClient(
    "https://fictional.example.test",
    async () => new Response("fictional token/raw DB failure", { status: 500 }),
  );
  await assert.rejects(
    client.request("/api/auth/csrf"),
    (error) => error.message === "Operator request did not complete",
  );
});
