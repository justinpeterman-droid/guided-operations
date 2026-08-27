"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { getRetentionDeletionApproval } from "./retention-deletion-request";

type State = "idle" | "confirming" | "submitting" | "completed" | "failed";

/** Requires a second passcode check and exact record-ID confirmation. */
export function ExecuteRetentionDeletionControl({
  requestId,
  recordId,
}: Readonly<{ requestId: string; recordId: string }>) {
  const router = useRouter();
  const [state, setState] = useState<State>("idle");

  async function execute(form: HTMLFormElement) {
    const values = new FormData(form);
    const confirmRecordId = values.get("confirmRecordId");
    const passcode = values.get("administratorPasscode");
    if (confirmRecordId !== recordId || typeof passcode !== "string")
      return setState("failed");

    setState("submitting");
    try {
      const proof = await getRetentionDeletionApproval("execute", passcode);
      const response = await fetch(
        `/api/admin/retention-deletions/${requestId}/execute`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": proof.csrfToken,
          },
          body: JSON.stringify({
            requestId: proof.requestId,
            token: proof.token,
            confirmRecordId,
          }),
        },
      );
      if (!response.ok) throw new Error("execution_failed");
      setState("completed");
      router.refresh();
    } catch {
      setState("failed");
    }
  }

  if (state === "completed")
    return <span className="report-status">Deletion completed</span>;
  if (state !== "confirming" && state !== "submitting")
    return (
      <div className="account-session-actions">
        <button onClick={() => setState("confirming")} type="button">
          Review permanent deletion
        </button>
        {state === "failed" ? (
          <p aria-live="polite" className="account-session-message">
            Deletion did not complete. The database transaction was rolled back.
            Any export already removed must be restored from the verified backup
            before retrying.
          </p>
        ) : null}
      </div>
    );

  return (
    <form
      className="account-session-confirm"
      onSubmit={(event) => {
        event.preventDefault();
        void execute(event.currentTarget);
      }}
    >
      <p>
        This permanently removes the approved database record package and its
        registered private exports. A new legal hold, expired backup, changed
        manifest, or failed Storage check stops the transaction.
      </p>
      <label htmlFor={`delete-confirm-${requestId}`}>
        Type the exact record ID to continue
      </label>
      <input
        autoComplete="off"
        id={`delete-confirm-${requestId}`}
        name="confirmRecordId"
        pattern={recordId}
        required
      />
      <label htmlFor={`delete-execution-passcode-${requestId}`}>
        Re-enter your administrator passcode
      </label>
      <input
        autoComplete="current-password"
        id={`delete-execution-passcode-${requestId}`}
        minLength={8}
        name="administratorPasscode"
        required
        type="password"
      />
      <button disabled={state === "submitting"} type="submit">
        {state === "submitting" ? "Deleting…" : "Permanently delete"}
      </button>
      <button
        disabled={state === "submitting"}
        onClick={() => setState("idle")}
        type="button"
      >
        Cancel
      </button>
    </form>
  );
}
