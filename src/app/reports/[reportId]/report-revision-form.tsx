"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type SubmissionState = "idle" | "saving" | "failed" | "conflict";

async function getCsrfToken(): Promise<string> {
  const response = await fetch("/api/auth/csrf", {
    credentials: "same-origin",
  });
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
  const [state, setState] = useState<SubmissionState>("idle");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!narrative.trim() || !reason.trim()) return;
    setState("saving");
    try {
      const csrfToken = await getCsrfToken();
      const response = await fetch(
        `/api/web/v1/reports/${reportId}/revisions`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
            "x-csrf-token": csrfToken,
            "idempotency-key": crypto.randomUUID().replaceAll("-", ""),
          },
          body: JSON.stringify({
            baseRevisionNumber: revisionNumber,
            narrative: narrative.trim(),
            reason: reason.trim(),
          }),
        },
      );
      if (response.status === 409) {
        setState("conflict");
        return;
      }
      if (!response.ok) {
        setState("failed");
        return;
      }
      setState("idle");
      setReason("");
      router.refresh();
    } catch {
      setState("failed");
    }
  }

  return (
    <form className="draft-finalization-form" onSubmit={submit}>
      <h2>Create a corrected revision</h2>
      <p>
        This adds a new immutable version. The current report is never edited or
        removed.
      </p>
      <label>
        Corrected narrative
        <textarea
          onChange={(event) => setNarrative(event.target.value)}
          required
          value={narrative}
        />
      </label>
      <label>
        Correction reason
        <input
          maxLength={500}
          onChange={(event) => setReason(event.target.value)}
          required
          value={reason}
        />
      </label>
      <button
        className="incident-primary"
        disabled={state === "saving" || !narrative.trim() || !reason.trim()}
        type="submit"
      >
        {state === "saving"
          ? "Saving correction…"
          : "Create corrected revision"}
      </button>
      <p aria-live="polite" className="incident-status">
        {state === "conflict"
          ? "A newer revision was saved. Your correction is still here; copy it, then reload the report before trying again."
          : state === "failed"
            ? "The correction could not be saved. Nothing was changed."
            : null}
      </p>
    </form>
  );
}
