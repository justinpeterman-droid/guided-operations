"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { DownloadReportButton } from "./download-report-button";

type Revision = Readonly<{
  revisionNumber: number;
  reason: string | null;
  createdAt: string;
  isCurrent: boolean;
  restoredFromRevisionNumber: number | null;
}>;

async function csrfToken() {
  const response = await fetch("/api/auth/csrf", {
    credentials: "same-origin",
  });
  const data: unknown = await response.json();
  if (
    !response.ok ||
    !data ||
    typeof data !== "object" ||
    !("csrfToken" in data) ||
    typeof data.csrfToken !== "string"
  )
    throw new Error("csrf");
  return data.csrfToken;
}

export function ReportHistory({
  reportId,
  currentRevisionNumber,
  revisions,
  allowDownload = false,
}: {
  reportId: string;
  currentRevisionNumber: number;
  revisions: readonly Revision[];
  allowDownload?: boolean;
}) {
  const router = useRouter();
  const [selectedRevision, setSelectedRevision] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");

  async function restore(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedRevision || !reason.trim()) return;
    setMessage("Saving restore…");
    try {
      const token = await csrfToken();
      const response = await fetch(`/api/web/v1/reports/${reportId}/restore`, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": token,
          "idempotency-key": crypto.randomUUID().replaceAll("-", ""),
        },
        body: JSON.stringify({
          baseRevisionNumber: currentRevisionNumber,
          restoreRevisionNumber: selectedRevision,
          reason: reason.trim(),
        }),
      });
      if (response.ok) {
        router.refresh();
        return;
      }
      setMessage(
        response.status === 409
          ? "A newer revision exists. Your reason is still here; reload before trying again."
          : "The restore could not be saved. Nothing was changed.",
      );
    } catch {
      setMessage("The restore could not be saved. Nothing was changed.");
    }
  }

  return (
    <section
      className="draft-finalization-form"
      aria-labelledby="history-title"
    >
      <h2 id="history-title">Revision history</h2>
      <p>
        Every version remains preserved. Restoring a version creates a new
        revision; it never replaces the old one.
      </p>
      <ol className="report-history-list">
        {revisions.map((revision) => (
          <li key={revision.revisionNumber}>
            <strong>
              Revision {revision.revisionNumber}
              {revision.isCurrent ? " (current)" : ""}
            </strong>
            <span>
              {revision.restoredFromRevisionNumber
                ? `Restored from revision ${revision.restoredFromRevisionNumber}.`
                : (revision.reason ?? "Initial final report.")}
            </span>
            <button
              type="button"
              disabled={revision.isCurrent}
              onClick={() => {
                setSelectedRevision(revision.revisionNumber);
                setMessage("");
              }}
            >
              Restore this version
            </button>
            {allowDownload ? (
              <DownloadReportButton
                reportId={reportId}
                revisionNumber={revision.revisionNumber}
              />
            ) : null}
          </li>
        ))}
      </ol>
      {selectedRevision ? (
        <form onSubmit={restore}>
          <p>Restore revision {selectedRevision} as a new version.</p>
          <label>
            Restore reason
            <input
              required
              maxLength={500}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          <button
            className="incident-primary"
            disabled={!reason.trim()}
            type="submit"
          >
            Create restored revision
          </button>
        </form>
      ) : null}
      <p aria-live="polite" className="workspace-status-message">
        {message}
      </p>
    </section>
  );
}
