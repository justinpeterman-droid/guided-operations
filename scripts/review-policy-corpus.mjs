import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { open, readFile, stat } from "node:fs/promises";
import { emitKeypressEvents } from "node:readline";
import { pathToFileURL } from "node:url";

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u;
const digest = /^[a-f0-9]{64}$/u;

export function parseArguments(argv) {
  const [action, ...args] = argv;
  if (!["prepare", "approve"].includes(action))
    throw new Error("Use prepare or approve");
  const allowed =
    action === "prepare"
      ? ["--origin", "--document-version", "--ingestion-run", "--output"]
      : [
          "--origin",
          "--manifest",
          "--source",
          "--review-record",
          "--confirm-reviewed-version",
        ];
  const options = { action };
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (!allowed.includes(flag) || Object.hasOwn(options, flag))
      throw new Error("Invalid operator option");
    if (flag === "--confirm-reviewed-version") options[flag] = true;
    else {
      const value = args[++i];
      if (!value || value.startsWith("--"))
        throw new Error("Missing operator option");
      options[flag] = value;
    }
  }
  if (allowed.some((flag) => !options[flag]))
    throw new Error("Required operator option missing");
  const origin = new URL(options["--origin"]);
  if (
    origin.protocol !== "https:" ||
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash ||
    ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname)
  )
    throw new Error("Production HTTPS origin required");
  if (
    action === "prepare" &&
    (!uuid.test(options["--document-version"]) ||
      !uuid.test(options["--ingestion-run"]))
  )
    throw new Error("Exact version and run identifiers required");
  return { ...options, origin: origin.origin };
}

export function createReviewManifest(snapshot) {
  if (
    snapshot?.protocol !== "policy-full-review-v1" ||
    !uuid.test(snapshot.versionId) ||
    !uuid.test(snapshot.runId) ||
    !digest.test(snapshot.sourceSha256) ||
    !digest.test(snapshot.registrySha256) ||
    !Array.isArray(snapshot.pages) ||
    !Array.isArray(snapshot.chunks) ||
    snapshot.pages.length < 1 ||
    snapshot.pages.length > 1000 ||
    snapshot.chunks.length < 1 ||
    snapshot.chunks.length > 2000 ||
    snapshot.pages.some(
      (p) =>
        !Number.isSafeInteger(p.page) ||
        !digest.test(p.textSha256) ||
        !digest.test(p.evidenceSha256),
    ) ||
    snapshot.chunks.some(
      (c) =>
        !uuid.test(c.id) ||
        !Number.isSafeInteger(c.ordinal) ||
        !Number.isSafeInteger(c.pageStart) ||
        !Number.isSafeInteger(c.pageEnd) ||
        !digest.test(c.textSha256) ||
        !digest.test(c.evidenceSha256),
    )
  )
    throw new Error("Invalid review snapshot");
  // Copy only allowlisted metadata, even if a server response has extra fields.
  return {
    protocol: snapshot.protocol,
    reviewId: randomUUID(),
    versionId: snapshot.versionId,
    runId: snapshot.runId,
    sourceSha256: snapshot.sourceSha256,
    registrySha256: snapshot.registrySha256,
    sourceReviewed: false,
    reviewRecordSha256: "",
    pages: snapshot.pages.map((p) => ({
      page: p.page,
      textSha256: p.textSha256,
      evidenceSha256: p.evidenceSha256,
      reviewed: false,
    })),
    chunks: snapshot.chunks.map((c) => ({
      id: c.id,
      ordinal: c.ordinal,
      pageStart: c.pageStart,
      pageEnd: c.pageEnd,
      textSha256: c.textSha256,
      evidenceSha256: c.evidenceSha256,
      reviewed: false,
    })),
  };
}

export function verifyApprovedOrigin(origin, approvedOrigin) {
  if (!approvedOrigin) throw new Error("Approved production origin required");
  let approved;
  try {
    approved = new URL(approvedOrigin);
  } catch {
    throw new Error("Invalid approved production origin");
  }
  if (
    approved.protocol !== "https:" ||
    approved.username ||
    approved.password ||
    approved.pathname !== "/" ||
    approved.search ||
    approved.hash ||
    ["localhost", "127.0.0.1", "[::1]"].includes(approved.hostname) ||
    origin !== approved.origin
  )
    throw new Error(
      "Operator origin does not match approved production origin",
    );
}

export function validateReviewedManifest(value) {
  const skeleton = createReviewManifest(value);
  if (
    !uuid.test(value.reviewId) ||
    value.sourceReviewed !== true ||
    !digest.test(value.reviewRecordSha256) ||
    value.pages.some((p) => p.reviewed !== true) ||
    value.chunks.some((c) => c.reviewed !== true) ||
    Object.keys(value).sort().join() !== Object.keys(skeleton).sort().join() ||
    value.pages.some(
      (p) =>
        Object.keys(p).sort().join() !==
        "evidenceSha256,page,reviewed,textSha256",
    ) ||
    value.chunks.some(
      (c) =>
        Object.keys(c).sort().join() !==
        "evidenceSha256,id,ordinal,pageEnd,pageStart,reviewed,textSha256",
    )
  )
    throw new Error("Human review is incomplete");
  return value;
}

export function createOperatorClient(origin, fetcher = fetch) {
  const cookies = new Map();
  let csrf;
  return {
    async request(path, body) {
      if (
        ![
          "/api/auth/sign-in",
          "/api/auth/csrf",
          "/api/auth/sign-out",
          "/api/admin/policy-review",
        ].includes(path)
      )
        throw new Error("Unapproved operator endpoint");
      const response = await fetcher(`${origin}${path}`, {
        method: body === undefined ? "GET" : "POST",
        redirect: "error",
        signal: AbortSignal.timeout(30000),
        headers: {
          Origin: origin,
          "Content-Type": "application/json",
          Cookie: [...cookies]
            .map(([key, value]) => `${key}=${value}`)
            .join("; "),
          ...(csrf ? { "x-csrf-token": csrf } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      for (const cookie of response.headers.getSetCookie()) {
        const pair = cookie.split(";", 1)[0];
        const separator = pair.indexOf("=");
        if (separator > 0)
          cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
      }
      if (!response.ok) throw new Error("Operator request did not complete");
      const text = await response.text();
      if (Buffer.byteLength(text) > 524288)
        throw new Error("Operator response is too large");
      const result = JSON.parse(text);
      if (path === "/api/auth/csrf") {
        if (
          typeof result.csrfToken !== "string" ||
          result.csrfToken.length > 256
        )
          throw new Error("CSRF unavailable");
        csrf = result.csrfToken;
      }
      return result;
    },
    clear() {
      cookies.clear();
      csrf = undefined;
    },
  };
}

async function fileDigest(path) {
  const info = await stat(path);
  if (!info.isFile() || info.size < 1 || info.size > 100 * 1024 * 1024)
    throw new Error("Invalid private review file");
  const hash = createHash("sha256");
  for await (const part of createReadStream(path)) hash.update(part);
  return hash.digest("hex");
}

/** No credentials in argv, environment variables, shell history, files or output. */
function hiddenInput(label, maxLength) {
  if (!process.stdin.isTTY || !process.stdout.isTTY)
    throw new Error("Private interactive terminal required");
  process.stdout.write(label);
  emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  return new Promise((resolve, reject) => {
    let value = "";
    const finish = (error) => {
      process.stdin.off("keypress", onKey);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write("\n");
      if (error) reject(new Error("Operator cancelled"));
      else resolve(value);
      value = "";
    };
    const onKey = (text, key) => {
      if (key?.ctrl && key.name === "c") return finish(true);
      if (key?.name === "return") return finish(false);
      if (key?.name === "backspace") value = value.slice(0, -1);
      else if (
        text &&
        !key?.ctrl &&
        /^[\x20-\x7e]+$/u.test(text) &&
        value.length + text.length <= maxLength
      )
        value += text;
    };
    process.stdin.on("keypress", onKey);
  });
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArguments(argv);
  // Provision independently in the protected operator environment, never from argv.
  verifyApprovedOrigin(options.origin, process.env.POLICY_CORPUS_REVIEW_ORIGIN);
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0")
    throw new Error("TLS verification required");
  let review;
  if (options.action === "approve") {
    const info = await stat(options["--manifest"]);
    if (!info.isFile() || info.size > 524288)
      throw new Error("Invalid review manifest");
    review = validateReviewedManifest(
      JSON.parse(await readFile(options["--manifest"], "utf8")),
    );
    if (
      (await fileDigest(options["--source"])) !== review.sourceSha256 ||
      (await fileDigest(options["--review-record"])) !==
        review.reviewRecordSha256
    )
      throw new Error("Private source or review record does not match");
  }
  process.stdout.write(
    "Use the approved Production operator environment; terminal capture must be off.\n",
  );
  const client = createOperatorClient(options.origin);
  let signedIn = false;
  try {
    const employeeNumber = await hiddenInput("Employee number (hidden): ", 64);
    let passcode = await hiddenInput("Passcode (hidden): ", 64);
    await client.request("/api/auth/sign-in", { employeeNumber, passcode });
    passcode = "";
    signedIn = true;
    await client.request("/api/auth/csrf");
    if (options.action === "prepare") {
      const result = await client.request("/api/admin/policy-review", {
        action: "prepare",
        versionId: options["--document-version"],
        runId: options["--ingestion-run"],
      });
      const file = await open(options["--output"], "wx", 0o600);
      try {
        await file.writeFile(
          JSON.stringify(createReviewManifest(result.data), null, 2) + "\n",
        );
      } finally {
        await file.close();
      }
      process.stdout.write(
        "Review manifest prepared. Every review decision is still unapproved.\n",
      );
    } else {
      const freshPasscode = await hiddenInput(
        "Confirm passcode for this exact reviewed version (hidden): ",
        64,
      );
      const result = await client.request("/api/admin/policy-review", {
        action: "approve",
        review,
        passcode: freshPasscode,
      });
      if (
        !["approved_for_embedding", "already_approved"].includes(
          result.data?.status,
        ) ||
        result.data?.searchable !== false
      )
        throw new Error("Approval result could not be verified");
      process.stdout.write(
        "QA approval recorded. Version remains pending and unsearchable.\n",
      );
    }
  } finally {
    if (signedIn) {
      try {
        await client.request("/api/auth/csrf");
        await client.request("/api/auth/sign-out", {});
      } catch {
        process.stderr.write(
          "Operator sign-out could not be confirmed. End this session through the application.\n",
        );
      }
    }
    client.clear();
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    await main();
  } catch {
    process.stderr.write(
      "Policy review did not complete. Inspect the private review state before retrying; details are not logged.\n",
    );
    process.exitCode = 1;
  }
}
