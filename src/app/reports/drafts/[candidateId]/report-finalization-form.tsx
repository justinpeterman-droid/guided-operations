"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { z } from "zod";
import { useUnsavedChanges } from "@/app/components/use-unsaved-changes";
import { useIdempotentRequest } from "@/app/components/use-idempotent-request";

type FinalizationState = "idle" | "saving" | "failed" | "expired" | "saved";

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

export function ReportFinalizationForm({
  candidateId,
  initialNarrative,
}: {
  candidateId: string;
  initialNarrative: string;
}) {
  const router = useRouter();
  const [narrative, setNarrative] = useState(initialNarrative);
  const [reviewedByOfficer, setReviewedByOfficer] = useState(false);
  const [state, setState] = useState<FinalizationState>("idle");
  const saving = useRef(false);
  const prepareRequest = useIdempotentRequest();
  useUnsavedChanges(
    state !== "saved" && (narrative !== initialNarrative || reviewedByOfficer),
  );

  async function finalize(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      saving.current ||
      state === "saved" ||
      !reviewedByOfficer ||
      !narrative.trim()
    )
      return;
    saving.current = true;

    setState("saving");
    try {
      const request = prepareRequest(
        JSON.stringify({
          narrative: narrative.trim(),
          reviewedByOfficer: true,
        }),
      );
      const csrfToken = await getCsrfToken();
      const response = await fetch(
        `/api/web/v1/report-drafts/${candidateId}/finalize`,
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
      const data: unknown = await response.json();
      if (
        !response.ok ||
        !data ||
        typeof data !== "object" ||
        !("data" in data) ||
        !data.data ||
        typeof data.data !== "object" ||
        !("reportId" in data.data) ||
        typeof data.data.reportId !== "string" ||
        !z.uuid().safeParse(data.data.reportId).success
      ) {
        setState("failed");
        return;
      }
      setState("saved");
      router.replace(`/reports/${data.data.reportId}`);
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
      onSubmit={finalize}
      aria-busy={state === "saving"}
    >
      <h2>Make your reviewed report</h2>
      <p>
        Edit the draft as needed. Submitting creates an immutable first report
        revision; it cannot be done by the AI.
      </p>
      <label>
        <span id={`final-narrative-label-${candidateId}`}>Final narrative</span>
        <textarea
          aria-labelledby={`final-narrative-label-${candidateId}`}
          disabled={state === "saving" || state === "saved"}
          maxLength={50000}
          className="resize-vertical"
          onChange={(event) => {
            setNarrative(event.target.value);
            setReviewedByOfficer(false);
          }}
          required
          value={narrative}
        />
      </label>
      <label className="draft-finalization-attestation">
        <input
          disabled={state === "saving" || state === "saved"}
          checked={reviewedByOfficer}
          onChange={(event) => setReviewedByOfficer(event.target.checked)}
          type="checkbox"
        />
        I reviewed this narrative and am submitting it as my own final report.
      </label>
      <button
        className="incident-primary"
        disabled={
          state === "saving" ||
          state === "saved" ||
          !reviewedByOfficer ||
          !narrative.trim()
        }
        type="submit"
      >
        {state === "saving" ? "Creating final report…" : "Create final report"}
      </button>
      <p aria-live="polite" className="workspace-status-message">
        {state === "expired"
          ? "Your session ended. Your reviewed narrative is still here. Sign in in a separate tab, then return and retry."
          : state === "failed"
            ? "Save could not be confirmed. Your narrative is still here. Retry without changing it to check the same save."
            : null}
      </p>
      {state === "expired" ? (
        <a href="/login" target="_blank" rel="noopener noreferrer">
          Sign in again (opens a new tab)
        </a>
      ) : null}
    </form>
  );
}
