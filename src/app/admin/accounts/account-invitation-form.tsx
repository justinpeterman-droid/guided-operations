"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type FormState = "idle" | "submitting" | "failed";
type Handoff = Readonly<{
  employeeNumberHint: string;
  temporaryPasscode: string;
  temporaryPasscodeExpiresAt: string;
}>;

const FAILURE_MESSAGE =
  "We could not create that account. No passcode has been shown.";

function csrfTokenFrom(body: unknown): string | null {
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
  ) {
    return null;
  }
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
  ) {
    return null;
  }
  const data = body.data;
  return "employeeNumberHint" in data &&
    "temporaryPasscode" in data &&
    "temporaryPasscodeExpiresAt" in data &&
    typeof data.employeeNumberHint === "string" &&
    typeof data.temporaryPasscode === "string" &&
    typeof data.temporaryPasscodeExpiresAt === "string"
    ? {
        employeeNumberHint: data.employeeNumberHint,
        temporaryPasscode: data.temporaryPasscode,
        temporaryPasscodeExpiresAt: data.temporaryPasscodeExpiresAt,
      }
    : null;
}

/** Private account creation; the temporary passcode is kept only in component state. */
export function AccountInvitationForm() {
  const router = useRouter();
  const [state, setState] = useState<FormState>("idle");
  const [handoff, setHandoff] = useState<Handoff | null>(null);

  async function submit(form: HTMLFormElement) {
    setState("submitting");
    const values = new FormData(form);
    const employeeNumber = values.get("employeeNumber");
    const displayName = values.get("displayName");
    const role = values.get("role");
    const shiftCode = values.get("shiftCode");
    const administratorPasscode = values.get("administratorPasscode");
    if (
      typeof employeeNumber !== "string" ||
      typeof displayName !== "string" ||
      (role !== "officer" && role !== "administrator") ||
      !["A", "B", "C", "D", "U", "F"].includes(String(shiftCode)) ||
      typeof administratorPasscode !== "string"
    ) {
      setState("failed");
      return;
    }

    try {
      const csrfResponse = await fetch("/api/auth/csrf", {
        credentials: "same-origin",
      });
      const csrfToken = csrfTokenFrom(await csrfResponse.json());
      if (!csrfResponse.ok || !csrfToken) throw new Error("csrf_unavailable");

      const proofResponse = await fetch("/api/admin/account-create-step-up", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
        body: JSON.stringify({ passcode: administratorPasscode }),
      });
      const proof = proofFrom(await proofResponse.json());
      if (!proofResponse.ok || !proof) throw new Error("step_up_denied");

      const invitationResponse = await fetch("/api/admin/accounts", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
        body: JSON.stringify({
          employeeNumber,
          displayName,
          role,
          shiftCode,
          ...proof,
        }),
      });
      const nextHandoff = handoffFrom(await invitationResponse.json());
      if (!invitationResponse.ok || !nextHandoff) {
        throw new Error("invitation_failed");
      }
      form.reset();
      setHandoff(nextHandoff);
      setState("idle");
      router.refresh();
    } catch {
      setState("failed");
    }
  }

  if (handoff) {
    return (
      <section
        className="account-session-controls"
        aria-labelledby="handoff-title"
      >
        <p className="eyebrow">In-person handoff</p>
        <h2 id="handoff-title">
          Give this passcode to employee ending {handoff.employeeNumberHint}
        </h2>
        <p>
          This is the only time it is shown. Give it to them in person before it
          expires. They must replace it on their first sign-in.
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
  }

  return (
    <section
      className="account-session-controls"
      aria-labelledby="invite-title"
    >
      <p className="eyebrow">Private account setup</p>
      <h2 id="invite-title">Add an account</h2>
      <p>
        Public sign-up is disabled. You will confirm your own passcode before
        this account is created.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit(event.currentTarget);
        }}
      >
        <label htmlFor="new-employee-number">Employee number</label>
        <input
          id="new-employee-number"
          name="employeeNumber"
          required
          type="text"
        />
        <label htmlFor="new-display-name">Name</label>
        <input id="new-display-name" name="displayName" required type="text" />
        <label htmlFor="new-role">Account type</label>
        <select defaultValue="officer" id="new-role" name="role">
          <option value="officer">Officer</option>
          <option value="administrator">Administrator</option>
        </select>
        <label htmlFor="new-shift">Assigned shift</label>
        <select defaultValue="A" id="new-shift" name="shiftCode">
          <option value="A">A — day shift</option>
          <option value="B">B — day shift</option>
          <option value="C">C — night shift</option>
          <option value="D">D — night shift</option>
          <option value="U">U — five-day week</option>
          <option value="F">F — five-day field</option>
        </select>
        <label htmlFor="administrator-passcode">
          Your administrator passcode
        </label>
        <input
          autoComplete="current-password"
          id="administrator-passcode"
          minLength={8}
          name="administratorPasscode"
          required
          type="password"
        />
        <div className="account-session-actions">
          <button disabled={state === "submitting"} type="submit">
            {state === "submitting" ? "Creating account…" : "Create account"}
          </button>
        </div>
        <p aria-live="polite" className="account-session-message">
          {state === "failed" ? FAILURE_MESSAGE : null}
        </p>
      </form>
    </section>
  );
}
