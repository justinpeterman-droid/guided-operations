"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type State = "idle" | "confirming" | "submitting" | "failed" | "unlocked";

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
  if (
    typeof body !== "object" ||
    body === null ||
    !("data" in body) ||
    typeof body.data !== "object" ||
    body.data === null
  )
    return null;
  const data = body.data;
  return "requestId" in data &&
    "token" in data &&
    typeof data.requestId === "string" &&
    typeof data.token === "string"
    ? { requestId: data.requestId, token: data.token }
    : null;
}

/** One focused control for restoring a locked account after a fresh step-up. */
export function AccountUnlockControl({
  accountId,
  displayName,
}: Readonly<{ accountId: string; displayName: string }>) {
  const router = useRouter();
  const [state, setState] = useState<State>("idle");

  async function unlock(form: HTMLFormElement) {
    const passcode = new FormData(form).get("administratorPasscode");
    if (typeof passcode !== "string") return setState("failed");
    setState("submitting");
    try {
      const csrfResponse = await fetch("/api/auth/csrf", {
        credentials: "same-origin",
      });
      const csrf = csrfFrom(await csrfResponse.json());
      if (!csrfResponse.ok || !csrf) throw new Error("csrf_unavailable");
      const proofResponse = await fetch("/api/admin/account-unlock-step-up", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
        body: JSON.stringify({ passcode }),
      });
      const proof = proofFrom(await proofResponse.json());
      if (!proofResponse.ok || !proof) throw new Error("step_up_denied");
      const response = await fetch(`/api/admin/accounts/${accountId}/unlock`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
        body: JSON.stringify(proof),
      });
      if (!response.ok) throw new Error("unlock_failed");
      setState("unlocked");
      router.refresh();
    } catch {
      setState("failed");
    }
  }

  if (state === "unlocked")
    return <span className="report-status">Unlocked</span>;
  if (state !== "confirming" && state !== "submitting")
    return (
      <div className="account-session-actions">
        <button onClick={() => setState("confirming")} type="button">
          Unlock account
        </button>
        {state === "failed" ? (
          <p aria-live="polite" className="account-session-message">
            This account could not be unlocked.
          </p>
        ) : null}
      </div>
    );
  const submitting = state === "submitting";
  return (
    <form
      className="account-session-confirm"
      onSubmit={(event) => {
        event.preventDefault();
        void unlock(event.currentTarget);
      }}
    >
      <p>Unlock {displayName}? They will be able to sign in again.</p>
      <label htmlFor={`unlock-passcode-${accountId}`}>
        Your administrator passcode
      </label>
      <input
        autoComplete="current-password"
        id={`unlock-passcode-${accountId}`}
        minLength={8}
        name="administratorPasscode"
        required
        type="password"
      />
      <button disabled={submitting} type="submit">
        {submitting ? "Unlocking…" : "Confirm unlock"}
      </button>
      <button
        disabled={submitting}
        onClick={() => setState("idle")}
        type="button"
      >
        Cancel
      </button>
    </form>
  );
}
