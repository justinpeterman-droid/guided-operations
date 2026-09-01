"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type FinalizationState = "idle" | "saving" | "failed";

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

  async function finalize(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reviewedByOfficer || !narrative.trim()) return;

    setState("saving");
    try {
      const csrfToken = await getCsrfToken();
      const response = await fetch(
        `/api/web/v1/report-drafts/${candidateId}/finalize`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
            "x-csrf-token": csrfToken,
            "idempotency-key": crypto.randomUUID().replaceAll("-", ""),
          },
          body: JSON.stringify({
            narrative: narrative.trim(),
            reviewedByOfficer: true,
          }),
        },
      );
      const data: unknown = await response.json();
      if (
        !response.ok ||
        !data ||
        typeof data !== "object" ||
        !("data" in data) ||
        !data.data ||
        typeof data.data !== "object" ||
        !("reportId" in data.data) ||
        typeof data.data.reportId !== "string"
      ) {
        setState("failed");
        return;
      }
      router.replace(`/reports/${data.data.reportId}`);
    } catch {
      setState("failed");
    }
  }

  return (
    <form noValidate className="draft-finalization-form" onSubmit={finalize}>
      <h2>Make your reviewed report</h2>
      <p>
        Edit the draft as needed. Submitting creates an immutable first report
        revision; it cannot be done by the AI.
      </p>
      <label>
        Final narrative
        <textarea
          className="resize-none"
          onChange={(event) => setNarrative(event.target.value)}
          required
          value={narrative}
        />
      </label>
      <label className="draft-finalization-attestation">
        <input
          checked={reviewedByOfficer}
          onChange={(event) => setReviewedByOfficer(event.target.checked)}
          type="checkbox"
        />
        I reviewed this narrative and am submitting it as my own final report.
      </label>
      <button
        className="incident-primary"
        disabled={state === "saving" || !reviewedByOfficer || !narrative.trim()}
        type="submit"
      >
        {state === "saving" ? "Creating final report…" : "Create final report"}
      </button>
      <p aria-live="polite" className="workspace-status-message">
        {state === "failed"
          ? "The final report could not be created. Nothing was changed."
          : null}
      </p>
    </form>
  );
}
