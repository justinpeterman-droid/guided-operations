"use client";
import { Button } from "@/components/ui/button";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { useUnsavedChanges } from "./use-unsaved-changes";

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
]);
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const createdResponseSchema = z.object({
  data: z.object({
    requestId: z.uuid(),
    signedUploadUrl: z.string().url().nullable(),
  }),
});

async function confirmUpload(requestId: string): Promise<boolean> {
  const response = await fetch(
    `/api/web/v1/improvement-requests/${requestId}/form-upload/finalize`,
    {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": await getCsrfToken(),
      },
      body: "{}",
    },
  );
  if (response.status === 401) throw new Error("session_expired");
  const body: unknown = await response.json();
  if (
    response.status === 409 &&
    z
      .object({ error: z.object({ code: z.literal("upload_not_ready") }) })
      .safeParse(body).success
  )
    return false;
  if (
    !response.ok ||
    !z
      .object({ data: z.object({ finalized: z.literal(true) }) })
      .safeParse(body).success
  )
    throw new Error("finalize_failed");
  return true;
}

async function getCsrfToken(): Promise<string> {
  const response = await fetch("/api/auth/csrf", {
    credentials: "same-origin",
    cache: "no-store",
  });
  if (response.status === 401) throw new Error("session_expired");
  const body: unknown = await response.json();
  if (
    !response.ok ||
    !body ||
    typeof body !== "object" ||
    !("csrfToken" in body) ||
    typeof body.csrfToken !== "string"
  ) {
    throw new Error("csrf_unavailable");
  }
  return body.csrfToken;
}

async function sha256(file: File): Promise<string> {
  const bytes = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** A deliberately narrow intake: blank form candidates are quarantined before any review. */
export function FormCandidateRequestForm() {
  const router = useRouter();
  const attemptRef = useRef<{
    fingerprint: string;
    nonce: string;
    requestId?: string;
  } | null>(null);
  const [createdRequestId, setCreatedRequestId] = useState<string | null>(null);
  const [progress, setProgress] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const submittingRef = useRef(false);
  const locked = submitting || submitted;
  useUnsavedChanges(dirty && !submitted);
  const [error, setError] = useState<string | null>(null);

  async function submit(form: HTMLFormElement) {
    if (submittingRef.current || submitted) return;
    const values = new FormData(form);
    const title = String(values.get("title") ?? "").trim();
    const description = String(values.get("description") ?? "").trim();
    if (title.length < 2 || description.length < 3) {
      setError("Add a title and tell the reviewer what this form is for.");
      return;
    }
    if (
      file &&
      (!ALLOWED_TYPES.has(file.type) ||
        file.size < 1 ||
        file.size > MAX_FILE_BYTES)
    ) {
      setError("Use a PDF, DOCX, XLSX, JPG, or PNG file no larger than 10 MB.");
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setSessionExpired(false);
    setError(null);
    try {
      setProgress("Preparing your request…");
      const details = {
        requestKind: file ? "form_candidate" : "form_request",
        category: String(values.get("category")),
        description,
        form: {
          title,
          sourceAuthority:
            String(values.get("sourceAuthority") ?? "").trim() || undefined,
          sourceRevision:
            String(values.get("sourceRevision") ?? "").trim() || undefined,
          requestedUse: String(values.get("requestedUse")),
        },
        ...(file
          ? {
              file: {
                name: file.name,
                mediaType: file.type,
                byteSize: file.size,
                sha256: await sha256(file),
              },
            }
          : {}),
      };
      const fingerprint = JSON.stringify(details);
      if (attemptRef.current?.fingerprint !== fingerprint) {
        attemptRef.current = { fingerprint, nonce: crypto.randomUUID() };
        setCreatedRequestId(null);
      }
      const attempt = attemptRef.current;
      if (file && attempt.requestId) {
        setProgress("Checking the existing upload…");
        if (await confirmUpload(attempt.requestId)) {
          setSubmitted(true);
          router.replace(`/improvements/${attempt.requestId}?submitted=1`);
          return;
        }
      }
      setProgress("Creating or recovering your request…");
      const created = await fetch("/api/web/v1/improvement-requests", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": await getCsrfToken(),
        },
        body: JSON.stringify({ requestNonce: attempt.nonce, ...details }),
      });
      if (created.status === 401) throw new Error("session_expired");
      const createdBody = createdResponseSchema.safeParse(await created.json());
      if (!created.ok || !createdBody.success) throw new Error("create_failed");
      const data = createdBody.data.data;
      if (attempt.requestId && attempt.requestId !== data.requestId)
        throw new Error("request_mismatch");
      attempt.requestId = data.requestId;
      setCreatedRequestId(data.requestId);

      if (file) {
        if (typeof data.signedUploadUrl !== "string")
          throw new Error("upload_unavailable");
        setProgress("Uploading your blank form…");
        // A lost PUT response or existing object is resolved only by the
        // authenticated server's content-integrity check; never overwrite it.
        await fetch(data.signedUploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type, "x-upsert": "false" },
          body: file,
        }).catch(() => undefined);
        setProgress("Verifying the uploaded form…");
        if (!(await confirmUpload(data.requestId)))
          throw new Error("upload_failed");
      }
      setSubmitted(true);
      router.replace(`/improvements/${data.requestId}?submitted=1`);
    } catch (error) {
      const expired =
        error instanceof Error && error.message === "session_expired";
      setSessionExpired(expired);
      setError(
        expired
          ? "Your session ended. Your entries are still here. Sign in in a separate tab, then return and retry."
          : "Completion could not be confirmed. Your entries are still here. Retry unchanged to recover the same request; editing starts a separate request. Uploaded forms remain unavailable for use until approved.",
      );
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
      setProgress("");
    }
  }

  return (
    <form
      className="improvement-intake-form"
      aria-busy={submitting}
      onChange={(event) => {
        const values = new FormData(event.currentTarget);
        const hasText = [
          "title",
          "description",
          "sourceAuthority",
          "sourceRevision",
        ].some((name) => Boolean(values.get(name)));
        const hasFile = Boolean(
          event.currentTarget.querySelector<HTMLInputElement>(
            'input[type="file"]',
          )?.files?.length,
        );
        setDirty(
          hasText ||
            hasFile ||
            values.get("category") !== "missing_form" ||
            values.get("requestedUse") !== "view_only",
        );
      }}
      onSubmit={(event) => {
        event.preventDefault();
        void submit(event.currentTarget);
      }}
    >
      <div className="improvement-form-warning">
        <strong>Blank forms only.</strong> Do not upload completed paperwork,
        incident details, names, or other personal information. Uploaded
        candidates stay private and unavailable until reviewed.
      </div>
      <label htmlFor="form-title">Form name</label>
      <input
        disabled={locked}
        id="form-title"
        maxLength={160}
        minLength={2}
        name="title"
        required
      />
      <label htmlFor="form-purpose">What should this form help staff do?</label>
      <textarea
        disabled={locked}
        id="form-purpose"
        maxLength={4000}
        minLength={3}
        name="description"
        required
        rows={6}
      />
      <div className="improvement-form-grid">
        <label htmlFor="form-category">
          What kind of request is this?
          <select
            disabled={locked}
            defaultValue="missing_form"
            id="form-category"
            name="category"
          >
            <option value="missing_form">Add a missing form</option>
            <option value="outdated_form">Replace an outdated source</option>
            <option value="fillable_form">
              Request a browser-fillable form
            </option>
            <option value="form_problem">Report a problem with a form</option>
          </select>
        </label>
        <label htmlFor="form-requested-use">
          Requested use
          <select
            disabled={locked}
            defaultValue="view_only"
            id="form-requested-use"
            name="requestedUse"
          >
            <option value="view_only">View or obtain the approved form</option>
            <option value="browser_fillable">Complete it in the browser</option>
            <option value="workflow_connected">
              Connect it to a reviewed workflow
            </option>
          </select>
        </label>
      </div>
      <div className="improvement-form-grid">
        <label htmlFor="form-authority">
          Source or authority <span>(optional)</span>
          <input
            disabled={locked}
            id="form-authority"
            maxLength={160}
            minLength={2}
            name="sourceAuthority"
          />
        </label>
        <label htmlFor="form-revision">
          Revision or date <span>(optional)</span>
          <input
            disabled={locked}
            id="form-revision"
            maxLength={120}
            name="sourceRevision"
          />
        </label>
      </div>
      <label className="improvement-file-input" htmlFor="form-file">
        Attach a blank form candidate <span>(optional)</span>
        <input
          disabled={locked}
          accept=".pdf,.docx,.xlsx,image/jpeg,image/png"
          id="form-file"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          type="file"
        />
        <small>
          {file
            ? `${file.name} (${Math.ceil(file.size / 1024)} KB)`
            : "PDF, DOCX, XLSX, JPG, or PNG — 10 MB maximum."}
        </small>
      </label>
      {error ? (
        <p className="improvement-error" role="alert">
          {error}
        </p>
      ) : null}
      {sessionExpired ? (
        <a href="/login" target="_blank" rel="noopener noreferrer">
          Sign in again (opens a new tab)
        </a>
      ) : null}
      {createdRequestId && error ? (
        <a
          href={`/improvements/${createdRequestId}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Check this request (opens a new tab)
        </a>
      ) : null}
      <p role="status">{progress}</p>
      <div className="go-ui improvement-form-actions">
        <Button disabled={locked} type="submit">
          {submitting
            ? "Sending securely…"
            : file
              ? "Submit and upload for review"
              : "Send form request"}
        </Button>
      </div>
    </form>
  );
}
