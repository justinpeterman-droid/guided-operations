"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
]);
const MAX_FILE_BYTES = 10 * 1024 * 1024;

async function getCsrfToken(): Promise<string> {
  const response = await fetch("/api/auth/csrf", {
    credentials: "same-origin",
    cache: "no-store",
  });
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
  const requestNonce = useRef(crypto.randomUUID());
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(form: HTMLFormElement) {
    const values = new FormData(form);
    const title = String(values.get("title") ?? "").trim();
    const description = String(values.get("description") ?? "").trim();
    if (!title || !description) {
      setError("Add a title and tell the reviewer what this form is for.");
      return;
    }
    if (file && (!ALLOWED_TYPES.has(file.type) || file.size > MAX_FILE_BYTES)) {
      setError("Use a PDF, DOCX, XLSX, JPG, or PNG file no larger than 10 MB.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const csrfToken = await getCsrfToken();
      const request = {
        requestNonce: requestNonce.current,
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
      const created = await fetch("/api/web/v1/improvement-requests", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
        body: JSON.stringify(request),
      });
      const createdBody: unknown = await created.json();
      if (
        !created.ok ||
        !createdBody ||
        typeof createdBody !== "object" ||
        !("data" in createdBody)
      )
        throw new Error("create_failed");
      const data = createdBody.data as {
        requestId?: unknown;
        signedUploadUrl?: unknown;
      };
      if (typeof data.requestId !== "string") throw new Error("create_failed");

      if (file) {
        if (typeof data.signedUploadUrl !== "string")
          throw new Error("upload_unavailable");
        const uploaded = await fetch(data.signedUploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type, "x-upsert": "false" },
          body: file,
        });
        if (!uploaded.ok) throw new Error("upload_failed");
        const finalized = await fetch(
          `/api/web/v1/improvement-requests/${data.requestId}/form-upload/finalize`,
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
        if (!finalized.ok) throw new Error("finalize_failed");
      }
      router.replace(`/improvements/${data.requestId}?submitted=1`);
    } catch {
      setError(
        "Your request was not completed. No form was made available. You can try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      className="improvement-intake-form"
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
      <input id="form-title" maxLength={160} name="title" required />
      <label htmlFor="form-purpose">What should this form help staff do?</label>
      <textarea
        id="form-purpose"
        maxLength={4000}
        name="description"
        required
        rows={6}
      />
      <div className="improvement-form-grid">
        <label htmlFor="form-category">
          What kind of request is this?
          <select
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
          <input id="form-authority" maxLength={240} name="sourceAuthority" />
        </label>
        <label htmlFor="form-revision">
          Revision or date <span>(optional)</span>
          <input id="form-revision" maxLength={120} name="sourceRevision" />
        </label>
      </div>
      <label className="improvement-file-input" htmlFor="form-file">
        Attach a blank form candidate <span>(optional)</span>
        <input
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
      <div className="improvement-form-actions">
        <button disabled={submitting} type="submit">
          {submitting
            ? "Sending securely…"
            : file
              ? "Submit and upload for review"
              : "Send form request"}
        </button>
      </div>
    </form>
  );
}
