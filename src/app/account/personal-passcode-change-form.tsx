"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { SecretInput } from "@/app/components/secret-input";

type State = "idle" | "submitting" | "failed";

function csrfFrom(body: unknown): string | null {
  return typeof body === "object" &&
    body !== null &&
    "csrfToken" in body &&
    typeof body.csrfToken === "string"
    ? body.csrfToken
    : null;
}

/** Lets a signed-in person replace a known passcode and revokes all sessions. */
export function PersonalPasscodeChangeForm() {
  const router = useRouter();
  const [state, setState] = useState<State>("idle");

  async function submit(form: HTMLFormElement) {
    const formData = new FormData(form);
    const employeeNumber = formData.get("employeeNumber");
    const currentPasscode = formData.get("currentPasscode");
    const newPasscode = formData.get("newPasscode");
    const confirmPasscode = formData.get("confirmPasscode");
    if (
      typeof employeeNumber !== "string" ||
      typeof currentPasscode !== "string" ||
      typeof newPasscode !== "string" ||
      newPasscode !== confirmPasscode
    ) {
      setState("failed");
      return;
    }

    setState("submitting");
    try {
      const csrfResponse = await fetch("/api/auth/csrf", {
        credentials: "same-origin",
      });
      const csrf = csrfFrom(await csrfResponse.json());
      if (!csrfResponse.ok || !csrf) throw new Error("csrf_unavailable");
      const response = await fetch("/api/auth/change-passcode", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
        body: JSON.stringify({ employeeNumber, currentPasscode, newPasscode }),
      });
      if (!response.ok) throw new Error("change_failed");
      router.replace("/login");
      router.refresh();
    } catch {
      setState("failed");
    }
  }

  return (
    <form
      noValidate
      className="account-session-controls"
      onSubmit={(event) => {
        event.preventDefault();
        void submit(event.currentTarget);
      }}
    >
      <p className="eyebrow">Passcode safety</p>
      <h2>Change your personal passcode</h2>
      <p>
        Confirm your employee number and current passcode. After the change, the
        site signs you out everywhere so you can sign in again safely.
      </p>
      <label htmlFor="personal-employee-number">Confirm employee number</label>
      <input
        autoComplete="username"
        id="personal-employee-number"
        maxLength={32}
        name="employeeNumber"
        required
        type="text"
      />
      <label htmlFor="current-personal-passcode">Current passcode</label>
      <SecretInput
        autoComplete="current-password"
        id="current-personal-passcode"
        maxLength={64}
        name="currentPasscode"
        revealLabel="current passcode"
        required
      />
      <label htmlFor="new-personal-passcode">New personal passcode</label>
      <SecretInput
        autoComplete="new-password"
        id="new-personal-passcode"
        maxLength={64}
        minLength={8}
        name="newPasscode"
        revealLabel="new personal passcode"
        required
      />
      <label htmlFor="confirm-personal-passcode">Confirm new passcode</label>
      <SecretInput
        autoComplete="new-password"
        id="confirm-personal-passcode"
        maxLength={64}
        minLength={8}
        name="confirmPasscode"
        revealLabel="passcode confirmation"
        required
      />
      <div className="account-session-actions">
        <button disabled={state === "submitting"} type="submit">
          {state === "submitting" ? "Changing passcode…" : "Change passcode"}
        </button>
      </div>
      <p aria-live="polite" className="account-session-message">
        {state === "failed"
          ? "The passcode could not be changed. Check every entry and try again."
          : null}
      </p>
    </form>
  );
}
