"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type AccountRole = "officer" | "administrator";
type State = "idle" | "confirming" | "submitting" | "failed" | "changed";

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

/** Changes one active account role after a fresh administrator confirmation. */
export function AccountRoleChangeControl({
  accountId,
  currentRole,
  displayName,
}: Readonly<{
  accountId: string;
  currentRole: AccountRole;
  displayName: string;
}>) {
  const router = useRouter();
  const [state, setState] = useState<State>("idle");
  const newRole: AccountRole =
    currentRole === "officer" ? "administrator" : "officer";
  const actionLabel =
    newRole === "administrator" ? "Make administrator" : "Make officer";

  async function changeRole(form: HTMLFormElement) {
    const passcode = new FormData(form).get("administratorPasscode");
    if (typeof passcode !== "string") return setState("failed");
    setState("submitting");
    try {
      const csrfResponse = await fetch("/api/auth/csrf", {
        credentials: "same-origin",
      });
      const csrf = csrfFrom(await csrfResponse.json());
      if (!csrfResponse.ok || !csrf) throw new Error("csrf_unavailable");
      const proofResponse = await fetch(
        "/api/admin/account-change-role-step-up",
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
          body: JSON.stringify({ passcode }),
        },
      );
      const proof = proofFrom(await proofResponse.json());
      if (!proofResponse.ok || !proof) throw new Error("step_up_denied");
      const response = await fetch(
        `/api/admin/accounts/${accountId}/change-role`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
          body: JSON.stringify({ ...proof, newRole }),
        },
      );
      if (!response.ok) throw new Error("change_role_failed");
      setState("changed");
      router.refresh();
    } catch {
      setState("failed");
    }
  }

  if (state === "changed")
    return <span className="report-status">Role changed</span>;
  if (state !== "confirming" && state !== "submitting")
    return (
      <div className="account-session-actions">
        <button onClick={() => setState("confirming")} type="button">
          {actionLabel}
        </button>
        {state === "failed" ? (
          <p aria-live="polite" className="account-session-message">
            This account role could not be changed.
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
        void changeRole(event.currentTarget);
      }}
    >
      <p>
        {actionLabel} for {displayName}? You cannot change your own role, and
        the site will always protect its last active administrator.
      </p>
      <label htmlFor={`change-role-passcode-${accountId}`}>
        Your administrator passcode
      </label>
      <input
        autoComplete="current-password"
        id={`change-role-passcode-${accountId}`}
        minLength={8}
        name="administratorPasscode"
        required
        type="password"
      />
      <button disabled={submitting} type="submit">
        {submitting ? "Changing role…" : `Confirm: ${actionLabel}`}
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
