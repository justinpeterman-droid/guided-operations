"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { SecretInput } from "@/app/components/secret-input";
import type { DailyPaperworkTemplatePackageSummary } from "@/server/paperwork/list-daily-paperwork-template-packages";

import styles from "./daily-paperwork-package-manager.module.css";

const EXPECTED_FILES = [
  "assignment_roster.json",
  "uniform_inspection.json",
  "metal_detector_test.json",
  "perimeter_check.json",
  "random_search_log.json",
  "detector_sign_out.json",
] as const;

type State =
  "idle" | "reviewing" | "reviewed" | "registering" | "registered" | "failed";
type EvidenceEntry = Readonly<{
  kind: string;
  sourceByteLength: number;
  sourceSha256: string;
  mappedSha256: string;
}>;
type Evidence = Readonly<{
  mappingVersion: string;
  packageDigest: string;
  sourceCount: number;
  totalBytes: number;
  entries: readonly EvidenceEntry[];
}>;
type ReviewedPackage = Readonly<{
  evidence: Evidence;
  idempotencyKey: string;
  sourceAuthority: string;
  sourceRevision: string;
  activeFrom: string;
  expectedCurrentPackageDigest: string | null;
  files: readonly File[];
}>;

const FAILURE_MESSAGE =
  "The package could not be completed. Nothing was registered.";

export function DailyPaperworkPackageManager({
  packages,
  preview = false,
}: Readonly<{
  packages: readonly DailyPaperworkTemplatePackageSummary[];
  preview?: boolean;
}>) {
  const router = useRouter();
  const sourceFormRef = useRef<HTMLFormElement>(null);
  const [state, setState] = useState<State>("idle");
  const [reviewed, setReviewed] = useState<ReviewedPackage | null>(null);
  const [registeredDigest, setRegisteredDigest] = useState<string | null>(null);
  const currentPackage = packages.at(0) ?? null;
  const sourceLocked =
    preview ||
    state === "reviewing" ||
    state === "registering" ||
    reviewed !== null;

  function resetSourceForm() {
    const form = sourceFormRef.current;
    form?.reset();
    const fileInput = form?.elements.namedItem("sourceFiles");
    if (fileInput instanceof HTMLInputElement) fileInput.value = "";
  }

  async function review(form: HTMLFormElement) {
    setState("reviewing");
    setReviewed(null);
    setRegisteredDigest(null);

    const values = new FormData(form);
    const sourceAuthority = values.get("sourceAuthority");
    const sourceRevision = values.get("sourceRevision");
    const activeFrom = values.get("activeFrom");
    const fileInput = form.elements.namedItem("sourceFiles");
    const files =
      fileInput instanceof HTMLInputElement
        ? Array.from(fileInput.files ?? [])
        : [];
    if (
      typeof sourceAuthority !== "string" ||
      typeof sourceRevision !== "string" ||
      typeof activeFrom !== "string" ||
      !hasExpectedFiles(files)
    ) {
      setState("failed");
      return;
    }

    try {
      const csrfToken = await getCsrfToken();
      const expectedCurrentPackageDigest =
        currentPackage?.packageDigest ?? null;
      const response = await fetch(
        "/api/admin/daily-paperwork-template-package",
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "X-CSRF-Token": csrfToken },
          body: packageFormData({
            action: "validate",
            sourceAuthority,
            sourceRevision,
            activeFrom,
            expectedCurrentPackageDigest,
            files,
          }),
        },
      );
      const evidence = evidenceFrom(await response.json());
      if (!response.ok || !evidence) throw new Error("review_failed");
      setReviewed({
        evidence,
        idempotencyKey: crypto.randomUUID(),
        sourceAuthority,
        sourceRevision,
        activeFrom,
        expectedCurrentPackageDigest,
        files,
      });
      setState("reviewed");
    } catch {
      setState("failed");
    }
  }

  async function register(form: HTMLFormElement) {
    const passcode = new FormData(form).get("administratorPasscode");
    if (!reviewed || typeof passcode !== "string") {
      setState("failed");
      return;
    }

    setState("registering");
    try {
      const csrfToken = await getCsrfToken();
      const proofResponse = await fetch(
        "/api/admin/daily-paperwork-template-step-up",
        {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": csrfToken,
          },
          body: JSON.stringify({
            action: "import",
            passcode,
            packageDigest: reviewed.evidence.packageDigest,
          }),
        },
      );
      const proof = proofFrom(await proofResponse.json());
      if (!proofResponse.ok || !proof) throw new Error("step_up_denied");

      const registrationResponse = await fetch(
        "/api/admin/daily-paperwork-template-package",
        {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "X-CSRF-Token": csrfToken,
            "Idempotency-Key": reviewed.idempotencyKey,
          },
          body: packageFormData({
            action: "register",
            sourceAuthority: reviewed.sourceAuthority,
            sourceRevision: reviewed.sourceRevision,
            activeFrom: reviewed.activeFrom,
            expectedCurrentPackageDigest: reviewed.expectedCurrentPackageDigest,
            files: reviewed.files,
            proof,
          }),
        },
      );
      const registered = registeredPackageFrom(
        await registrationResponse.json(),
      );
      if (
        !registrationResponse.ok ||
        !registered ||
        registered.packageDigest !== reviewed.evidence.packageDigest
      )
        throw new Error("registration_failed");

      form.reset();
      resetSourceForm();
      setRegisteredDigest(registered.packageDigest);
      setReviewed(null);
      setState("registered");
      router.refresh();
    } catch {
      setState("failed");
    }
  }

  return (
    <div className={styles.manager}>
      <section
        className={styles.importPanel}
        aria-labelledby="package-import-title"
      >
        <div className={styles.sectionHeading}>
          <div>
            <p className="eyebrow">Approved definitions</p>
            <h2 id="package-import-title">Review a six-form package</h2>
          </div>
          <span>{preview ? "Preview only" : "Production only"}</span>
        </div>
        <p className={styles.intro}>
          Select the six approved JSON definitions together. The first step
          checks them without saving anything. Registration requires your
          administrator passcode and uses the exact package you reviewed.
        </p>

        <form
          noValidate
          className={styles.form}
          ref={sourceFormRef}
          onSubmit={(event) => {
            event.preventDefault();
            if (!preview) void review(event.currentTarget);
          }}
        >
          <div className={styles.fieldGrid}>
            <label>
              Source authority
              <input
                disabled={sourceLocked}
                maxLength={160}
                name="sourceAuthority"
                placeholder="Records owner or approved authority"
                required
              />
            </label>
            <label>
              Source revision
              <input
                disabled={sourceLocked}
                maxLength={160}
                name="sourceRevision"
                placeholder="Approved revision reference"
                required
              />
            </label>
            <label>
              Active date
              <input
                disabled={sourceLocked}
                name="activeFrom"
                required
                type="date"
              />
            </label>
          </div>

          <label className={styles.fileField}>
            Six approved JSON files
            <input
              accept="application/json,.json"
              disabled={sourceLocked}
              multiple
              name="sourceFiles"
              required
              type="file"
            />
          </label>
          <ul className={styles.fileList} aria-label="Required filenames">
            {EXPECTED_FILES.map((filename) => (
              <li key={filename}>{filename}</li>
            ))}
          </ul>

          <div className={styles.actions}>
            <button disabled={sourceLocked} type="submit">
              {state === "reviewing" ? "Checking package…" : "Review package"}
            </button>
          </div>
        </form>

        {reviewed ? (
          <section
            className={styles.review}
            aria-labelledby="package-review-title"
          >
            <p className="eyebrow">Checked, not registered</p>
            <h3 id="package-review-title">Review passed for all six forms</h3>
            <dl>
              <div>
                <dt>Package digest</dt>
                <dd>
                  <code>{reviewed.evidence.packageDigest}</code>
                </dd>
              </div>
              <div>
                <dt>Source files</dt>
                <dd>{reviewed.evidence.sourceCount}</dd>
              </div>
              <div>
                <dt>Total source size</dt>
                <dd>{formatBytes(reviewed.evidence.totalBytes)}</dd>
              </div>
            </dl>
            <form
              noValidate
              className={styles.confirmForm}
              onSubmit={(event) => {
                event.preventDefault();
                void register(event.currentTarget);
              }}
            >
              <label htmlFor="paperwork-package-administrator-passcode">
                Your administrator passcode
              </label>
              <SecretInput
                autoComplete="current-password"
                disabled={state === "registering"}
                id="paperwork-package-administrator-passcode"
                minLength={8}
                name="administratorPasscode"
                revealLabel="administrator passcode"
                required
              />
              <div className={styles.actions}>
                <button disabled={state === "registering"} type="submit">
                  {state === "registering"
                    ? "Registering package…"
                    : "Register approved package"}
                </button>
                <button
                  disabled={state === "registering"}
                  onClick={() => {
                    resetSourceForm();
                    setReviewed(null);
                    setState("idle");
                  }}
                  type="button"
                >
                  Cancel
                </button>
              </div>
            </form>
          </section>
        ) : null}

        <p className={styles.message} aria-live="polite">
          {preview
            ? "Fictional visual preview — all import controls are disabled."
            : state === "failed"
              ? FAILURE_MESSAGE
              : state === "registered" && registeredDigest
                ? `Package ${shortDigest(registeredDigest)} was registered.`
                : null}
        </p>
      </section>

      <section
        className={styles.historyPanel}
        aria-labelledby="package-history-title"
      >
        <div className={styles.sectionHeading}>
          <div>
            <p className="eyebrow">Value-free evidence</p>
            <h2 id="package-history-title">Package history</h2>
          </div>
          <span>{packages.length} shown</span>
        </div>
        <p className={styles.intro}>
          This list shows approval evidence only. It never displays form fields
          or completed paperwork.
        </p>
        {packages.length === 0 ? (
          <p className={styles.empty}>
            No approved package has been registered.
          </p>
        ) : (
          <ol className={styles.historyList}>
            {packages.map((item, index) => (
              <li key={item.packageId}>
                <div>
                  <p className="eyebrow">
                    {index === 0 ? "Current package" : "Earlier package"}
                  </p>
                  <h3>{item.sourceRevision}</h3>
                  <p>{item.sourceAuthority}</p>
                </div>
                <dl>
                  <div>
                    <dt>Active</dt>
                    <dd>{formatDate(item.activeFrom)}</dd>
                  </div>
                  <div>
                    <dt>Approved</dt>
                    <dd>{formatDateTime(item.approvedAt)}</dd>
                  </div>
                  <div>
                    <dt>Package</dt>
                    <dd>
                      <code>{shortDigest(item.packageDigest)}</code>
                    </dd>
                  </div>
                  <div>
                    <dt>Size</dt>
                    <dd>{formatBytes(item.totalSourceBytes)}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function packageFormData(
  input: Readonly<{
    action: "validate" | "register";
    sourceAuthority: string;
    sourceRevision: string;
    activeFrom: string;
    expectedCurrentPackageDigest: string | null;
    files: readonly File[];
    proof?: Readonly<{ requestId: string; token: string }>;
  }>,
): FormData {
  const form = new FormData();
  form.set("action", input.action);
  form.set("sourceAuthority", input.sourceAuthority);
  form.set("sourceRevision", input.sourceRevision);
  form.set("activeFrom", input.activeFrom);
  form.set(
    "expectedCurrentPackageDigest",
    input.expectedCurrentPackageDigest ?? "",
  );
  form.set("rollbackOfPackageDigest", "");
  if (input.proof) {
    form.set("requestId", input.proof.requestId);
    form.set("token", input.proof.token);
  }
  for (const file of input.files) form.append("files", file, file.name);
  return form;
}

function hasExpectedFiles(files: readonly File[]): boolean {
  if (files.length !== EXPECTED_FILES.length) return false;
  const filenames = new Set(files.map((file) => file.name));
  return EXPECTED_FILES.every((filename) => filenames.has(filename));
}

async function getCsrfToken(): Promise<string> {
  const response = await fetch("/api/auth/csrf", {
    credentials: "same-origin",
  });
  const token = csrfFrom(await response.json());
  if (!response.ok || !token) throw new Error("csrf_unavailable");
  return token;
}

function csrfFrom(body: unknown): string | null {
  return typeof body === "object" &&
    body !== null &&
    "csrfToken" in body &&
    typeof body.csrfToken === "string"
    ? body.csrfToken
    : null;
}

function proofFrom(
  body: unknown,
): Readonly<{ requestId: string; token: string }> | null {
  const data = dataFrom(body);
  return data &&
    "requestId" in data &&
    "token" in data &&
    typeof data.requestId === "string" &&
    typeof data.token === "string"
    ? { requestId: data.requestId, token: data.token }
    : null;
}

function evidenceFrom(body: unknown): Evidence | null {
  const data = dataFrom(body);
  if (
    !data ||
    !("evidence" in data) ||
    typeof data.evidence !== "object" ||
    data.evidence === null
  )
    return null;
  const evidence = data.evidence;
  if (
    !("mappingVersion" in evidence) ||
    typeof evidence.mappingVersion !== "string" ||
    !("packageDigest" in evidence) ||
    typeof evidence.packageDigest !== "string" ||
    !/^[a-f0-9]{64}$/u.test(evidence.packageDigest) ||
    !("sourceCount" in evidence) ||
    evidence.sourceCount !== 6 ||
    !("totalBytes" in evidence) ||
    typeof evidence.totalBytes !== "number" ||
    !("entries" in evidence) ||
    !Array.isArray(evidence.entries)
  )
    return null;
  const entries = evidence.entries.filter(isEvidenceEntry);
  if (entries.length !== 6) return null;
  return {
    mappingVersion: evidence.mappingVersion,
    packageDigest: evidence.packageDigest,
    sourceCount: evidence.sourceCount,
    totalBytes: evidence.totalBytes,
    entries,
  };
}

function isEvidenceEntry(value: unknown): value is EvidenceEntry {
  return (
    typeof value === "object" &&
    value !== null &&
    "kind" in value &&
    typeof value.kind === "string" &&
    "sourceByteLength" in value &&
    typeof value.sourceByteLength === "number" &&
    "sourceSha256" in value &&
    typeof value.sourceSha256 === "string" &&
    /^[a-f0-9]{64}$/u.test(value.sourceSha256) &&
    "mappedSha256" in value &&
    typeof value.mappedSha256 === "string" &&
    /^[a-f0-9]{64}$/u.test(value.mappedSha256)
  );
}

function registeredPackageFrom(
  body: unknown,
): Readonly<{ packageDigest: string }> | null {
  const data = dataFrom(body);
  if (
    !data ||
    !("evidence" in data) ||
    typeof data.evidence !== "object" ||
    data.evidence === null
  )
    return null;
  const evidence = data.evidence;
  return "packageDigest" in evidence &&
    typeof evidence.packageDigest === "string" &&
    /^[a-f0-9]{64}$/u.test(evidence.packageDigest)
    ? { packageDigest: evidence.packageDigest }
    : null;
}

function dataFrom(body: unknown): Record<string, unknown> | null {
  return typeof body === "object" &&
    body !== null &&
    "data" in body &&
    typeof body.data === "object" &&
    body.data !== null
    ? (body.data as Record<string, unknown>)
    : null;
}

function shortDigest(value: string): string {
  return `${value.slice(0, 10)}…${value.slice(-8)}`;
}

function formatBytes(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "unit",
    unit: "byte",
    unitDisplay: "short",
  }).format(value);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
