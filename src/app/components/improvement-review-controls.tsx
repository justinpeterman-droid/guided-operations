"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const options = [
  ["under_review", "review_started", "Start review"],
  ["needs_information", "follow_up_needed", "Request information"],
  ["planned", "planned", "Plan change"],
  [
    "ready_for_publication",
    "form_ready_for_publication",
    "Ready for protected publication",
  ],
  ["completed", "resolved", "Complete"],
  ["declined", "declined", "Decline"],
] as const;

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
  )
    throw new Error("csrf_unavailable");
  return body.csrfToken;
}

/** Status updates are review records only; they cannot publish a form. */
export function ImprovementReviewControls({
  requestId,
  requestKind,
  currentStatus,
}: Readonly<{
  requestId: string;
  requestKind: string;
  currentStatus: string;
}>) {
  const router = useRouter();
  const [nextStatus, setNextStatus] = useState("under_review");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const availableOptions = options.filter(
    ([status]) =>
      requestKind === "form_candidate" || status !== "ready_for_publication",
  );
  const selected =
    availableOptions.find(([status]) => status === nextStatus) ??
    availableOptions[0];
  if (["completed", "declined", "withdrawn"].includes(currentStatus))
    return null;
  async function update() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/web/v1/improvement-requests/${requestId}/status`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": await getCsrfToken(),
          },
          body: JSON.stringify({
            nextStatus: selected[0],
            reasonCode: selected[1],
            ...(message.trim() ? { followUpMessage: message.trim() } : {}),
          }),
        },
      );
      if (!response.ok) throw new Error("update_failed");
      setMessage("");
      router.refresh();
    } catch {
      setError("The status was not changed. Please try again.");
    } finally {
      setPending(false);
    }
  }
  return (
    <section
      className="improvement-review-controls"
      aria-label="Administrator review actions"
    >
      <h2>Administrator review</h2>
      <p>
        Changing status does not publish or replace a form. Eligible candidates
        still require protected template registration.
      </p>
      <label htmlFor="review-status">
        Update status
        <select
          id="review-status"
          onChange={(event) => setNextStatus(event.target.value)}
          value={nextStatus}
        >
          {availableOptions.map(([status, , label]) => (
            <option key={status} value={status}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label htmlFor="review-message">
        Message to submitter <span>(optional)</span>
        <textarea
          id="review-message"
          maxLength={3000}
          onChange={(event) => setMessage(event.target.value)}
          rows={4}
          value={message}
        />
      </label>
      {error ? (
        <p className="improvement-error" role="alert">
          {error}
        </p>
      ) : null}
      <button disabled={pending} onClick={() => void update()} type="button">
        {pending ? "Updating…" : "Save review update"}
      </button>
    </section>
  );
}
