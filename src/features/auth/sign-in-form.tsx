"use client";

import { useActionState } from "react";

import {
  initialLoginActionState,
  loginAction,
} from "@/app/actions/auth";

export function SignInForm({ enabled }: { enabled: boolean }) {
  const [state, formAction, pending] = useActionState(
    loginAction,
    initialLoginActionState,
  );

  return (
    <form action={formAction} aria-describedby="connection-status">
      <label htmlFor="employee-number">Employee number</label>
      <input
        id="employee-number"
        name="employeeNumber"
        autoComplete="username"
        autoCapitalize="characters"
        placeholder="Employee number"
        required
        maxLength={64}
        disabled={!enabled || pending}
      />

      <label htmlFor="personal-passcode">Personal passcode</label>
      <input
        id="personal-passcode"
        name="passcode"
        type="password"
        autoComplete="current-password"
        placeholder="Personal passcode"
        required
        maxLength={128}
        disabled={!enabled || pending}
      />

      <button type="submit" disabled={!enabled || pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>

      {state.message ? (
        <p className="form-message" role="alert" aria-live="polite">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
