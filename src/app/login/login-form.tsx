"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { SecretInput } from "@/app/components/secret-input";
import { Button } from "@/components/ui/button";

type SubmissionState = "idle" | "invalid" | "submitting" | "failed";

type MissingFields = {
  employeeNumber: boolean;
  passcode: boolean;
};

const GENERIC_FAILURE =
  "We could not sign you in. Check your employee number and passcode, then try again.";

/** Client boundary for the generic, same-origin employee-number sign-in request. */
export function LoginForm() {
  const router = useRouter();
  const [state, setState] = useState<SubmissionState>("idle");
  const [missingFields, setMissingFields] = useState<MissingFields>({
    employeeNumber: false,
    passcode: false,
  });
  const employeeNumberRef = useRef<HTMLInputElement>(null);
  const passcodeRef = useRef<HTMLInputElement>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const employeeNumber = form.get("employeeNumber");
    const passcode = form.get("passcode");
    if (typeof employeeNumber !== "string" || typeof passcode !== "string") {
      setState("failed");
      statusRef.current?.focus();
      return;
    }

    const missing = {
      employeeNumber: employeeNumber.trim().length === 0,
      passcode: passcode.length === 0,
    };
    if (missing.employeeNumber || missing.passcode) {
      setMissingFields(missing);
      setState("invalid");
      if (missing.employeeNumber) employeeNumberRef.current?.focus();
      else passcodeRef.current?.focus();
      return;
    }

    setMissingFields({ employeeNumber: false, passcode: false });
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
    statusRef.current?.focus();
  }

  const submitting = state === "submitting";
  const statusMessage =
    state === "invalid"
      ? missingFields.employeeNumber && missingFields.passcode
        ? "Enter your employee number and passcode."
        : missingFields.employeeNumber
          ? "Enter your employee number."
          : "Enter your passcode."
      : state === "failed"
        ? GENERIC_FAILURE
        : null;

  return (
    <form
      action="/api/auth/sign-in"
      className="login-form"
      method="post"
      noValidate
      onSubmit={submit}
    >
      <label htmlFor="employee-number">Employee number</label>
      <input
        autoComplete="username"
        disabled={submitting}
        id="employee-number"
        maxLength={32}
        name="employeeNumber"
        aria-describedby={
          missingFields.employeeNumber ? "login-status" : undefined
        }
        aria-invalid={missingFields.employeeNumber || undefined}
        ref={employeeNumberRef}
        required
      />

      <label htmlFor="passcode">Passcode</label>
      <SecretInput
        autoComplete="current-password"
        aria-describedby={missingFields.passcode ? "login-status" : undefined}
        aria-invalid={missingFields.passcode || undefined}
        disabled={submitting}
        id="passcode"
        maxLength={64}
        name="passcode"
        ref={passcodeRef}
        revealLabel="passcode"
        required
      />

      <div className="go-ui login-submit">
        <Button
          disabled={submitting}
          type="submit"
          size="lg"
          className="w-full"
        >
          {submitting ? "Signing in…" : "Sign in"}
        </Button>
      </div>
      <p
        aria-live="polite"
        className="login-status"
        id="login-status"
        ref={statusRef}
        tabIndex={-1}
      >
        {statusMessage}
      </p>
    </form>
  );
}
