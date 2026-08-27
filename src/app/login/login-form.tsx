"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type SubmissionState = "idle" | "submitting" | "failed";

const GENERIC_FAILURE =
  "We could not sign you in. Check your employee number and passcode, then try again.";

/** Client boundary for the generic, same-origin employee-number sign-in request. */
export function LoginForm() {
  const router = useRouter();
  const [state, setState] = useState<SubmissionState>("idle");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const employeeNumber = form.get("employeeNumber");
    const passcode = form.get("passcode");
    if (typeof employeeNumber !== "string" || typeof passcode !== "string") {
      setState("failed");
      return;
    }

    setState("submitting");
    try {
      const response = await fetch("/api/auth/sign-in", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeNumber, passcode }),
      });
      if (response.ok) {
        router.push("/home");
        return;
      }
    } catch {
      // The same safe failure message covers network and credential outcomes.
    }
    setState("failed");
  }

  const submitting = state === "submitting";

  return (
    <form
      action="/api/auth/sign-in"
      className="login-form"
      method="post"
      onSubmit={submit}
    >
      <label htmlFor="employee-number">Employee number</label>
      <input
        autoComplete="username"
        disabled={submitting}
        id="employee-number"
        maxLength={80}
        name="employeeNumber"
        required
      />

      <label htmlFor="passcode">Passcode</label>
      <input
        autoComplete="current-password"
        disabled={submitting}
        id="passcode"
        maxLength={256}
        name="passcode"
        required
        type="password"
      />

      <button disabled={submitting} type="submit">
        {submitting ? "Signing in…" : "Sign in"}
      </button>
      <p aria-live="polite" className="login-status">
        {state === "failed" ? GENERIC_FAILURE : null}
      </p>
    </form>
  );
}
