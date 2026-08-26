"use client";

import { useState } from "react";

async function csrfToken(): Promise<string> {
  const response = await fetch("/api/auth/csrf", {
    cache: "no-store",
    credentials: "same-origin",
  });
  const body: unknown = await response.json();
  if (
    !response.ok ||
    typeof body !== "object" ||
    body === null ||
    !("csrfToken" in body) ||
    typeof body.csrfToken !== "string"
  )
    throw new Error("csrf");
  return body.csrfToken;
}

export function PrintReportButton({
  reportId,
  revisionNumber,
}: Readonly<{ reportId: string; revisionNumber: number }>) {
  const [preparing, setPreparing] = useState(false);
  const [message, setMessage] = useState("");

  async function print() {
    if (preparing) return;
    setPreparing(true);
    setMessage("Recording the print request…");
    try {
      const token = await csrfToken();
      const response = await fetch(`/api/web/v1/reports/${reportId}/print`, {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          "content-type": "application/json",
          "idempotency-key": crypto.randomUUID().replaceAll("-", ""),
          "x-csrf-token": token,
        },
        body: JSON.stringify({ revisionNumber }),
      });
      const body: unknown = await response.json();
      if (response.status === 409) {
        setMessage("A newer report revision exists. Refresh before printing.");
        return;
      }
      if (
        !response.ok ||
        typeof body !== "object" ||
        body === null ||
        !("data" in body) ||
        typeof body.data !== "object" ||
        body.data === null ||
        !("recorded" in body.data) ||
        body.data.recorded !== true
      )
        throw new Error("print");
      setMessage("Print request recorded. Opening the browser print dialog.");
      window.print();
    } catch {
      setMessage(
        "The print request could not be recorded, so no print dialog was opened.",
      );
    } finally {
      setPreparing(false);
    }
  }

  return (
    <>
      <button
        className="reports-home-link report-print-button"
        disabled={preparing}
        onClick={() => void print()}
        type="button"
      >
        {preparing ? "Preparing print…" : "Print current report"}
      </button>
      {message ? (
        <span aria-live="polite" role="status">
          {message}
        </span>
      ) : null}
    </>
  );
}
