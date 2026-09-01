"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { SecretInput } from "@/app/components/secret-input";

type State = "idle" | "confirming" | "submitting" | "failed" | "disabled";

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

/** One focused control for disabling a roster account after a fresh step-up. */
export function AccountDisableControl({
  accountId,
  displayName,
}: Readonly<{ accountId: string; displayName: string }>) {
  const router = useRouter();
  const [state, setState] = useState<State>("idle");

  async function disable(form: HTMLFormElement) {
    const passcode = new FormData(form).get("administratorPasscode");
    if (typeof passcode !== "string") return setState("failed");
    setState("submitting");
    try {
      const csrfResponse = await fetch("/api/auth/csrf", {
        credentials: "same-origin",
      });
      const csrf = csrfFrom(await csrfResponse.json());
      if (!csrfResponse.ok || !csrf) throw new Error("csrf_unavailable");
      const proofResponse = await fetch("/api/admin/account-disable-step-up", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
        body: JSON.stringify({ passcode }),
      });
      const proof = proofFrom(await proofResponse.json());
      if (!proofResponse.ok || !proof) throw new Error("step_up_denied");
      const response = await fetch(`/api/admin/accounts/${accountId}/disable`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
        body: JSON.stringify(proof),
      });
      if (!response.ok) throw new Error("disable_failed");
      setState("disabled");
      router.refresh();
    } catch {
      setState("failed");
    }
  }

  if (state === "disabled")
    return <span className="report-status">Disabled</span>;
  if (state !== "confirming" && state !== "submitting")
    return (
      <div className="account-session-actions">
        <button onClick={() => setState("confirming")} type="button">
          Disable account
        </button>
        {state === "failed" ? (
          <p aria-live="polite" className="account-session-message">
            This account could not be disabled.
          </p>
        ) : null}
      </div>
    );
  const submitting = state === "submitting";
  return (
    <form
      noValidate
      className="account-session-confirm"
      onSubmit={(event) => {
        event.preventDefault();
        void disable(event.currentTarget);
      }}
    >
      <p>
        Disable {displayName}? They will be signed out and unable to use the
        site.
      </p>
      <label htmlFor={`disable-passcode-${accountId}`}>
        Your administrator passcode
      </label>
      <SecretInput
        autoComplete="current-password"
        disabled={submitting}
        id={`disable-passcode-${accountId}`}
        minLength={8}
        name="administratorPasscode"
        revealLabel="administrator passcode"
        required
      />
      <button disabled={submitting} type="submit">
        {submitting ? "Disabling…" : "Confirm disable"}
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
