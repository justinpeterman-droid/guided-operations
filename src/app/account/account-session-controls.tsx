"use client";

import { useState } from "react";

import { redirectToLogin } from "@/lib/navigation/full-login-redirect";

type SessionAction = "local" | "all";
type SessionControlState = "idle" | "submitting" | "failed";

const FAILURE_MESSAGE = "We could not update your sessions. Please try again.";

function endpointFor(action: SessionAction) {
  return action === "all" ? "/api/auth/sign-out-all" : "/api/auth/sign-out";
}

/**
 * Gives an authenticated person explicit control over just this browser or all
 * provider sessions. Both operations acquire a fresh session-bound CSRF token.
 */
export function AccountSessionControls() {
  const [state, setState] = useState<SessionControlState>("idle");
  const [confirmAll, setConfirmAll] = useState(false);
  const submitting = state === "submitting";

  async function signOut(action: SessionAction) {
    setState("submitting");
    try {
      const csrfResponse = await fetch("/api/auth/csrf", {
        credentials: "same-origin",
      });
      const csrfBody: unknown = await csrfResponse.json();
      const csrfToken =
        typeof csrfBody === "object" &&
        csrfBody !== null &&
        "csrfToken" in csrfBody &&
        typeof csrfBody.csrfToken === "string"
          ? csrfBody.csrfToken
          : null;
      if (!csrfResponse.ok || !csrfToken) throw new Error("csrf_unavailable");

      const response = await fetch(endpointFor(action), {
        method: "POST",
        credentials: "same-origin",
        headers: { "X-CSRF-Token": csrfToken },
      });
      if (!response.ok) throw new Error("sign_out_failed");

      // A full-document navigation makes the session boundary explicit. The
      // server has just cleared the signed-in cookie, so an App Router cache
      // transition can otherwise leave the protected account page visible.
      redirectToLogin();
    } catch {
      setState("failed");
    }
  }

  return (
    <section
      className="account-session-controls"
      aria-labelledby="sessions-title"
    >
      <p className="eyebrow">Session safety</p>
      <h2 id="sessions-title">Your signed-in devices</h2>
      <p>
        Sign out of this browser when you are finished. If a device may be lost
        or shared, you can also sign out everywhere.
      </p>
      <div className="account-session-actions">
        <button
          disabled={submitting}
          onClick={() => signOut("local")}
          type="button"
        >
          {submitting ? "Signing out…" : "Sign out of this browser"}
        </button>
        {confirmAll ? (
          <div
            className="account-session-confirm"
            role="group"
            aria-label="Confirm sign out everywhere"
          >
            <p>This will sign you out on every device.</p>
            <button
              disabled={submitting}
              onClick={() => signOut("all")}
              type="button"
            >
              Confirm sign out everywhere
            </button>
            <button
              disabled={submitting}
              onClick={() => setConfirmAll(false)}
              type="button"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            disabled={submitting}
            onClick={() => setConfirmAll(true)}
            type="button"
          >
            Sign out everywhere
          </button>
        )}
      </div>
      <p aria-live="polite" className="account-session-message">
        {state === "failed" ? FAILURE_MESSAGE : null}
      </p>
    </section>
  );
}
