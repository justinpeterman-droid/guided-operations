"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { SecretInput } from "@/app/components/secret-input";

import { getLegalHoldApproval } from "./legal-hold-request";

type State = "idle" | "confirming" | "submitting" | "released" | "failed";

/** Releases one hold through a separate release-specific confirmation. */
export function ReleaseLegalHoldControl({
  holdId,
}: Readonly<{ holdId: string }>) {
  const router = useRouter();
  const [state, setState] = useState<State>("idle");

  async function release(form: HTMLFormElement) {
    const values = new FormData(form);
    const authorityReference = values.get("authorityReference");
    const passcode = values.get("administratorPasscode");
    if (typeof authorityReference !== "string" || typeof passcode !== "string")
      return setState("failed");

    setState("submitting");
    try {
      const approval = await getLegalHoldApproval("release", passcode);
      const response = await fetch(`/api/admin/legal-holds/${holdId}/release`, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": approval.csrfToken,
        },
        body: JSON.stringify({
          requestId: approval.requestId,
          token: approval.token,
          authorityReference,
        }),
      });
      if (!response.ok) throw new Error("hold_not_released");
      setState("released");
      router.refresh();
    } catch {
      setState("failed");
    }
  }

  if (state === "released")
    return <span className="report-status">Hold released</span>;
  if (state !== "confirming" && state !== "submitting")
    return (
      <div className="account-session-actions">
        <button onClick={() => setState("confirming")} type="button">
          Release hold
        </button>
        {state === "failed" ? (
          <p aria-live="polite" className="account-session-message">
            This hold could not be released. It remains active.
          </p>
        ) : null}
      </div>
    );

  return (
    <form
      noValidate
      className="account-session-confirm"
      onSubmit={(event) => {
        event.preventDefault();
        void release(event.currentTarget);
      }}
    >
      <p>
        Releasing a hold is permanent. The hold evidence remains in the
        register, but it will no longer block deletion review.
      </p>
      <label htmlFor={`release-authority-${holdId}`}>
        Release authority reference
      </label>
      <input
        autoComplete="off"
        id={`release-authority-${holdId}`}
        maxLength={160}
        minLength={3}
        name="authorityReference"
        pattern="[A-Za-z0-9][A-Za-z0-9 ._:/-]*"
        required
        type="text"
      />
      <label htmlFor={`release-passcode-${holdId}`}>
        Your administrator passcode
      </label>
      <SecretInput
        autoComplete="current-password"
        disabled={state === "submitting"}
        id={`release-passcode-${holdId}`}
        minLength={8}
        name="administratorPasscode"
        revealLabel="administrator passcode"
        required
      />
      <button disabled={state === "submitting"} type="submit">
        {state === "submitting" ? "Releasing hold…" : "Confirm release"}
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
