"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { SecretInput } from "@/app/components/secret-input";

type State = "idle" | "confirming" | "submitting" | "failed";
type Handoff = Readonly<{
  temporaryPasscode: string;
  temporaryPasscodeExpiresAt: string;
}>;

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

function handoffFrom(body: unknown): Handoff | null {
  if (
    typeof body !== "object" ||
    body === null ||
    !("data" in body) ||
    typeof body.data !== "object" ||
    body.data === null
  )
    return null;
  const data = body.data;
  return "temporaryPasscode" in data &&
    "temporaryPasscodeExpiresAt" in data &&
    typeof data.temporaryPasscode === "string" &&
    typeof data.temporaryPasscodeExpiresAt === "string"
    ? {
        temporaryPasscode: data.temporaryPasscode,
        temporaryPasscodeExpiresAt: data.temporaryPasscodeExpiresAt,
      }
    : null;
}

/** Issues a temporary account passcode only after a fresh admin confirmation. */
export function AccountPasscodeResetControl({
  accountId,
  displayName,
}: Readonly<{ accountId: string; displayName: string }>) {
  const router = useRouter();
  const [state, setState] = useState<State>("idle");
  const [handoff, setHandoff] = useState<Handoff | null>(null);

  async function reset(form: HTMLFormElement) {
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
        "/api/admin/account-reset-passcode-step-up",
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
        `/api/admin/accounts/${accountId}/reset-passcode`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
          body: JSON.stringify(proof),
        },
      );
      const nextHandoff = handoffFrom(await response.json());
      if (!response.ok || !nextHandoff) throw new Error("reset_failed");
      setHandoff(nextHandoff);
      setState("idle");
      router.refresh();
    } catch {
      setState("failed");
    }
  }

  if (handoff)
    return (
      <section
        className="account-session-controls"
        aria-labelledby={`reset-${accountId}`}
      >
        <p className="eyebrow">In-person handoff</p>
        <h3 id={`reset-${accountId}`}>Give this passcode to {displayName}</h3>
        <p>
          This is the only time it is shown. They must replace it on sign-in.
        </p>
        <p className="account-session-message" role="status">
          <strong>{handoff.temporaryPasscode}</strong>
        </p>
        <p>
          Expires{" "}
          {new Date(handoff.temporaryPasscodeExpiresAt).toLocaleString()}.
        </p>
        <button onClick={() => setHandoff(null)} type="button">
          I have handed it over
        </button>
      </section>
    );
  if (state !== "confirming" && state !== "submitting")
    return (
      <div className="account-session-actions">
        <button onClick={() => setState("confirming")} type="button">
          Reset passcode
        </button>
        {state === "failed" ? (
          <p aria-live="polite" className="account-session-message">
            This passcode could not be reset.
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
        void reset(event.currentTarget);
      }}
    >
      <p>
        Reset {displayName}&apos;s passcode? Their current sessions will end.
      </p>
      <label htmlFor={`reset-passcode-${accountId}`}>
        Your administrator passcode
      </label>
      <SecretInput
        autoComplete="current-password"
        disabled={submitting}
        id={`reset-passcode-${accountId}`}
        minLength={8}
        name="administratorPasscode"
        revealLabel="administrator passcode"
        required
      />
      <button disabled={submitting} type="submit">
        {submitting ? "Resetting…" : "Confirm reset"}
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
