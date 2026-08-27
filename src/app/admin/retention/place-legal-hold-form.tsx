"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { getLegalHoldApproval } from "./legal-hold-request";

type State = "idle" | "submitting" | "placed" | "failed";

/** Places a hold only after a fresh, placement-specific administrator check. */
export function PlaceLegalHoldForm() {
  const router = useRouter();
  const [state, setState] = useState<State>("idle");

  async function place(form: HTMLFormElement) {
    const values = new FormData(form);
    const scopeType = values.get("scopeType");
    const scopeId = values.get("scopeId");
    const authorityReference = values.get("authorityReference");
    const passcode = values.get("administratorPasscode");
    if (
      typeof scopeType !== "string" ||
      typeof scopeId !== "string" ||
      typeof authorityReference !== "string" ||
      typeof passcode !== "string"
    )
      return setState("failed");

    setState("submitting");
    try {
      const approval = await getLegalHoldApproval("place", passcode);
      const response = await fetch("/api/admin/legal-holds", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": approval.csrfToken,
        },
        body: JSON.stringify({
          requestId: approval.requestId,
          token: approval.token,
          scopeType,
          scopeId,
          authorityReference,
        }),
      });
      if (!response.ok) throw new Error("hold_not_placed");
      form.reset();
      setState("placed");
      router.refresh();
    } catch {
      setState("failed");
    }
  }

  return (
    <section
      className="reports-list-section"
      aria-labelledby="place-hold-title"
    >
      <h2 id="place-hold-title">Place a legal hold</h2>
      <p>
        Use the target record ID and a short authority or case reference. Do not
        enter report narratives, names, or other record details here.
      </p>
      <form
        className="account-session-confirm"
        onSubmit={(event) => {
          event.preventDefault();
          void place(event.currentTarget);
        }}
      >
        <label htmlFor="legal-hold-scope">Record type</label>
        <select id="legal-hold-scope" name="scopeType" required>
          <option value="facility">Entire facility</option>
          <option value="incident">Incident</option>
          <option value="report">Report</option>
          <option value="paperwork_record">Paperwork record</option>
          <option value="policy_document">Policy document</option>
          <option value="staff_member">Staff member</option>
          <option value="user_account">User account</option>
        </select>
        <label htmlFor="legal-hold-scope-id">Target record ID</label>
        <input
          autoComplete="off"
          id="legal-hold-scope-id"
          name="scopeId"
          pattern="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}"
          placeholder="00000000-0000-4000-8000-000000000000"
          required
          type="text"
        />
        <label htmlFor="legal-hold-authority">Authority reference</label>
        <input
          autoComplete="off"
          id="legal-hold-authority"
          maxLength={160}
          minLength={3}
          name="authorityReference"
          pattern="[A-Za-z0-9][A-Za-z0-9 ._:/-]*"
          required
          type="text"
        />
        <label htmlFor="legal-hold-passcode">Your administrator passcode</label>
        <input
          autoComplete="current-password"
          id="legal-hold-passcode"
          minLength={8}
          name="administratorPasscode"
          required
          type="password"
        />
        <button disabled={state === "submitting"} type="submit">
          {state === "submitting" ? "Placing hold…" : "Confirm legal hold"}
        </button>
        <p aria-live="polite" className="account-session-message">
          {state === "placed"
            ? "The legal hold was placed and recorded."
            : state === "failed"
              ? "The legal hold could not be placed. No record was changed."
              : ""}
        </p>
      </form>
    </section>
  );
}
