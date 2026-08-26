"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ShiftCode = "A" | "B" | "C" | "D" | "U" | "F";
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

/** Changes one roster shift after a fresh purpose-bound administrator check. */
export function AccountShiftChangeControl({
  accountId,
  currentShiftCode,
  displayName,
}: Readonly<{
  accountId: string;
  currentShiftCode: ShiftCode | null;
  displayName: string;
}>) {
  const router = useRouter();
  const [state, setState] = useState<State>("idle");

  async function changeShift(form: HTMLFormElement) {
    const values = new FormData(form);
    const passcode = values.get("administratorPasscode");
    const newShiftCode = values.get("newShiftCode");
    if (
      typeof passcode !== "string" ||
      !["A", "B", "C", "D", "U", "F"].includes(String(newShiftCode))
    )
      return setState("failed");
    setState("submitting");
    try {
      const csrfResponse = await fetch("/api/auth/csrf", {
        credentials: "same-origin",
      });
      const csrf = csrfFrom(await csrfResponse.json());
      if (!csrfResponse.ok || !csrf) throw new Error("csrf_unavailable");
      const proofResponse = await fetch(
        "/api/admin/account-change-shift-step-up",
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
        `/api/admin/accounts/${accountId}/change-shift`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
          body: JSON.stringify({ ...proof, newShiftCode }),
        },
      );
      if (!response.ok) throw new Error("change_shift_failed");
      setState("changed");
      router.refresh();
    } catch {
      setState("failed");
    }
  }

  if (state === "changed")
    return <span className="report-status">Shift changed</span>;
  if (state !== "confirming" && state !== "submitting")
    return (
      <div className="account-session-actions">
        <button onClick={() => setState("confirming")} type="button">
          Change shift
        </button>
        {state === "failed" ? (
          <p aria-live="polite" className="account-session-message">
            This account shift could not be changed.
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
        void changeShift(event.currentTarget);
      }}
    >
      <p>
        Change the assigned shift for {displayName}. Existing sessions for that
        account will be revoked.
      </p>
      <label htmlFor={`new-shift-${accountId}`}>New assigned shift</label>
      <select
        defaultValue={currentShiftCode ?? "A"}
        id={`new-shift-${accountId}`}
        name="newShiftCode"
      >
        <option value="A">A — day shift</option>
        <option value="B">B — day shift</option>
        <option value="C">C — night shift</option>
        <option value="D">D — night shift</option>
        <option value="U">U — five-day week</option>
        <option value="F">F — five-day field</option>
      </select>
      <label htmlFor={`change-shift-passcode-${accountId}`}>
        Your administrator passcode
      </label>
      <input
        autoComplete="current-password"
        id={`change-shift-passcode-${accountId}`}
        minLength={8}
        name="administratorPasscode"
        required
        type="password"
      />
      <button disabled={submitting} type="submit">
        {submitting ? "Changing shift…" : "Confirm shift change"}
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
