"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { useUnsavedChanges } from "@/app/components/use-unsaved-changes";
import { useIdempotentRequest } from "@/app/components/use-idempotent-request";

type SubmissionState =
  "idle" | "saving" | "failed" | "conflict" | "expired" | "saved";

async function getCsrfToken(): Promise<string> {
  const response = await fetch("/api/auth/csrf", {
    credentials: "same-origin",
  });
  if (response.status === 401) throw new Error("session_expired");
  const data: unknown = await response.json();
  if (
    !response.ok ||
    !data ||
    typeof data !== "object" ||
    !("csrfToken" in data) ||
    typeof data.csrfToken !== "string"
  )
    throw new Error("csrf");
  return data.csrfToken;
}

export function ReportRevisionForm({
  reportId,
  revisionNumber,
  initialNarrative,
}: {
  reportId: string;
  revisionNumber: number;
  initialNarrative: string;
}) {
  const router = useRouter();
  const [narrative, setNarrative] = useState(initialNarrative);
  const [reason, setReason] = useState("");
  const [baseRevisionNumber] = useState(revisionNumber);
  const revisionChanged = baseRevisionNumber !== revisionNumber;
  const [state, setState] = useState<SubmissionState>("idle");
  const saving = useRef(false);
  const prepareRequest = useIdempotentRequest();
  useUnsavedChanges(
    state !== "saved" && (narrative !== initialNarrative || Boolean(reason)),
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      saving.current ||
      revisionChanged ||
      state === "saved" ||
      !narrative.trim() ||
      !reason.trim()
    )
      return;
    saving.current = true;
    setState("saving");
    try {
      const request = prepareRequest(
        JSON.stringify({
          baseRevisionNumber,
          narrative: narrative.trim(),
          reason: reason.trim(),
        }),
      );
      const csrfToken = await getCsrfToken();
      const response = await fetch(
        `/api/web/v1/reports/${reportId}/revisions`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
            "x-csrf-token": csrfToken,
            "idempotency-key": request.key,
          },
          body: request.body,
        },
      );
      if (response.status === 401) throw new Error("session_expired");
      if (response.status === 409) {
        setState("conflict");
        return;
      }
      if (!response.ok) {
        setState("failed");
        return;
      }
      const result: unknown = await response.json();
      if (
        !result ||
        typeof result !== "object" ||
        !("data" in result) ||
        !result.data ||
        typeof result.data !== "object" ||
        !("revisionNumber" in result.data) ||
        result.data.revisionNumber !== baseRevisionNumber + 1
      )
        throw new Error("response");
      setState("saved");
      setReason("");
      router.refresh();
    } catch (error) {
      setState(
        error instanceof Error && error.message === "session_expired"
          ? "expired"
          : "failed",
      );
    } finally {
      saving.current = false;
    }
  }

  return (
    <form
      className="draft-finalization-form"
      onSubmit={submit}
      aria-busy={state === "saving"}
    >
      <h2>Create a corrected revision</h2>
      <p>
        This adds a new immutable version. The current report is never edited or
        removed.
      </p>
      <label>
        <span id={`corrected-narrative-label-${reportId}`}>
          Corrected narrative
        </span>
        <textarea
          aria-labelledby={`corrected-narrative-label-${reportId}`}
          disabled={state === "saving" || state === "saved"}
          maxLength={50000}
          className="resize-vertical"
          onChange={(event) => setNarrative(event.target.value)}
          required
          value={narrative}
        />
      </label>
      <label>
        Correction reason
        <input
          disabled={state === "saving" || state === "saved"}
          maxLength={500}
          onChange={(event) => setReason(event.target.value)}
          required
          value={reason}
        />
      </label>
      <button
        className="incident-primary"
        disabled={
          state === "saving" ||
          state === "saved" ||
          revisionChanged ||
          !narrative.trim() ||
          !reason.trim()
        }
        type="submit"
      >
        {state === "saving"
          ? "Saving correction…"
          : "Create corrected revision"}
      </button>
      <p aria-live="polite" className="workspace-status-message">
        {state === "saved"
          ? "Correction saved. Open the updated report before making another correction."
          : state === "expired"
            ? "Your session ended. Your correction is still here. Sign in in a separate tab, then return and retry."
            : state === "conflict" || revisionChanged
              ? "A newer revision was saved. Your correction is still here; copy it, then reload the report before trying again."
              : state === "failed"
                ? "Save could not be confirmed. Your correction is still here. Retry without changing it to check the same save."
                : null}
      </p>
      {state === "expired" ? (
        <a href="/login" target="_blank" rel="noopener noreferrer">
          Sign in again (opens a new tab)
        </a>
      ) : null}
      {state === "saved" ? (
        <a href={`/reports/${reportId}`}>Open updated report</a>
      ) : null}
      {revisionChanged && state !== "saved" ? (
        <a href={`/reports/${reportId}`}>Reload current report</a>
      ) : null}
    </form>
  );
}
