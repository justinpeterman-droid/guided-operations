"use client";

import { useActionState } from "react";

import {
  changePasscodeAction,
  initialChangePasscodeActionState,
} from "@/app/actions/auth";

export function ChangePasscodeForm({ csrfToken }: { csrfToken: string }) {
  const [state, formAction, pending] = useActionState(
    changePasscodeAction,
    initialChangePasscodeActionState,
  );

  return (
    <form action={formAction}>
      <input type="hidden" name="csrfToken" value={csrfToken} />

      <label htmlFor="new-passcode">New personal passcode</label>
      <input
        id="new-passcode"
        name="newPasscode"
        type="password"
        autoComplete="new-password"
        required
        minLength={10}
        maxLength={64}
        disabled={pending}
      />

      <label htmlFor="confirm-passcode">Confirm new passcode</label>
      <input
        id="confirm-passcode"
        name="confirmPasscode"
        type="password"
        autoComplete="new-password"
        required
        minLength={10}
        maxLength={64}
        disabled={pending}
      />

      <p className="passcode-guidance">
        Use 10–64 characters with letters and numbers. Avoid your employee
        number, repeated characters, sequences, and common passcodes.
      </p>

      <button type="submit" disabled={pending}>
        {pending ? "Updating…" : "Set personal passcode"}
      </button>

      {state.message ? (
        <p className="form-message" role="alert" aria-live="polite">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
