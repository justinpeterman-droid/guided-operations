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

export function DownloadReportButton({
  reportId,
  revisionNumber,
  current,
}: Readonly<{
  reportId: string;
  revisionNumber: number;
  current?: boolean;
}>) {
  const [preparing, setPreparing] = useState(false);
  const [message, setMessage] = useState("");

  async function download() {
    if (preparing) return;
    setPreparing(true);
    setMessage(`Preparing revision ${revisionNumber}…`);
    try {
      const token = await csrfToken();
      const response = await fetch(
        `/api/web/v1/reports/${reportId}/export-docx?revision=${revisionNumber}`,
        {
          method: "POST",
          cache: "no-store",
          credentials: "same-origin",
          headers: {
            "idempotency-key": crypto.randomUUID().replaceAll("-", ""),
            "x-csrf-token": token,
          },
        },
      );
      if (!response.ok) {
        setMessage(
          response.status === 409
            ? "That download request conflicted with an earlier request. Try again."
            : "The Word file could not be prepared. Nothing was changed.",
        );
        return;
      }
      if (
        response.headers.get("content-type") !==
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        response.headers.get("x-report-revision") !== String(revisionNumber)
      )
        throw new Error("unexpected-output");
      const blob = await response.blob();
      if (blob.size < 1) throw new Error("empty");
      const objectUrl = URL.createObjectURL(blob);
      try {
        const anchor = document.createElement("a");
        anchor.href = objectUrl;
        anchor.download = `report-${reportId}-revision-${revisionNumber}.docx`;
        anchor.click();
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
      setMessage(`Downloaded report revision ${revisionNumber}.`);
    } catch {
      setMessage("The Word file could not be prepared. Nothing was changed.");
    } finally {
      setPreparing(false);
    }
  }

  return (
    <span className="report-download-control">
      <button
        className={
          current ? "reports-home-link report-output-button" : undefined
        }
        disabled={preparing}
        onClick={() => void download()}
        type="button"
      >
        {preparing
          ? "Preparing Word file…"
          : current
            ? "Download current Word file"
            : "Download this version"}
      </button>
      <span aria-live="polite" className="report-output-status" role="status">
        {message}
      </span>
    </span>
  );
}
