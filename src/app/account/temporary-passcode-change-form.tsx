"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { SecretInput } from "@/app/components/secret-input";

type FormState = "idle" | "submitting" | "failed";

const FAILURE_MESSAGE =
  "We could not change your passcode. Check the requirements and try again.";

/** The only browser UI available while a temporary passcode is active. */
export function TemporaryPasscodeChangeForm({
  csrfToken,
}: Readonly<{ csrfToken: string | null }>) {
  const router = useRouter();
  const [state, setState] = useState<FormState>("idle");

  async function submit(form: HTMLFormElement) {
    setState("submitting");
    const employeeNumber = new FormData(form).get("employeeNumber");
    const passcode = new FormData(form).get("passcode");
    if (typeof employeeNumber !== "string" || typeof passcode !== "string") {
      setState("failed");
      return;
    }

    try {
      const csrf = await fetch("/api/auth/csrf", {
        credentials: "same-origin",
      });
      const csrfBody: unknown = await csrf.json();
      const csrfToken =
        typeof csrfBody === "object" &&
        csrfBody !== null &&
        "csrfToken" in csrfBody &&
        typeof csrfBody.csrfToken === "string"
          ? csrfBody.csrfToken
          : null;
      if (!csrf.ok || !csrfToken) throw new Error("csrf_unavailable");

      const response = await fetch(
        "/api/auth/complete-temporary-passcode-change",
        {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": csrfToken,
          },
          body: JSON.stringify({ employeeNumber, passcode }),
        },
      );
      if (!response.ok) throw new Error("passcode_change_failed");

      router.replace("/login");
      router.refresh();
    } catch {
      setState("failed");
    }
  }

  return (
    <form
      action="/api/auth/complete-temporary-passcode-change"
      className="account-session-controls"
      method="post"
      onSubmit={(event) => {
        event.preventDefault();
        void submit(event.currentTarget);
      }}
    >
      <input name="csrfToken" type="hidden" value={csrfToken ?? ""} />
      <p className="eyebrow">Account security</p>
      <h2>Choose your personal passcode</h2>
      <p>
        Your temporary passcode must be replaced before you can use this
        workspace. Use 8–64 letters, numbers, or symbols with no spaces. Do not
        reuse your employee number or a simple common pattern.
      </p>
      <label htmlFor="employee-number">Confirm employee number</label>
      <input
        autoComplete="username"
        id="employee-number"
        maxLength={32}
        name="employeeNumber"
        required
        type="text"
      />
      <label htmlFor="new-passcode">New personal passcode</label>
      <SecretInput
        autoComplete="new-password"
        id="new-passcode"
        maxLength={64}
        minLength={8}
        name="passcode"
        revealLabel="new personal passcode"
        required
      />
      <div className="account-session-actions">
        <button disabled={state === "submitting"} type="submit">
          {state === "submitting" ? "Changing passcode…" : "Change passcode"}
        </button>
      </div>
      <p aria-live="polite" className="account-session-message">
        {state === "failed" ? FAILURE_MESSAGE : null}
      </p>
    </form>
  );
}
