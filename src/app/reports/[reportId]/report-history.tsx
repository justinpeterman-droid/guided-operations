"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { z } from "zod";
import { useIdempotentRequest } from "@/app/components/use-idempotent-request";
import { useUnsavedChanges } from "@/app/components/use-unsaved-changes";
import { Button } from "@/components/ui/button";

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
  if (response.status === 401) throw new Error("session_expired");
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
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [baseRevision, setBaseRevision] = useState(currentRevisionNumber);
  const [completedRevision, setCompletedRevision] = useState(0);
  const prepareRequest = useIdempotentRequest();
  const waitingForRefresh = completedRevision > currentRevisionNumber;
  useUnsavedChanges(Boolean(reason) && selectedRevision !== null);

  async function restore(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      busyRef.current ||
      waitingForRefresh ||
      !selectedRevision ||
      !reason.trim()
    )
      return;
    if (baseRevision !== currentRevisionNumber) {
      setMessage(
        "A newer revision exists. Your reason is still here; select the version again after reviewing the current report.",
      );
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setSessionExpired(false);
    setMessage("Saving restore…");
    try {
      const command = prepareRequest(
        JSON.stringify({
          baseRevisionNumber: baseRevision,
          restoreRevisionNumber: selectedRevision,
          reason: reason.trim(),
        }),
      );
      const token = await csrfToken();
      const response = await fetch(`/api/web/v1/reports/${reportId}/restore`, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": token,
          "idempotency-key": command.key,
        },
        body: command.body,
      });
      if (response.status === 401) throw new Error("session_expired");
      if (response.ok) {
        const result = z
          .object({
            data: z.object({ revisionNumber: z.number().int().positive() }),
          })
          .parse(await response.json());
        if (result.data.revisionNumber !== baseRevision + 1)
          throw new Error("response");
        setCompletedRevision(result.data.revisionNumber);
        setSelectedRevision(null);
        setReason("");
        setMessage(`Restored as revision ${result.data.revisionNumber}.`);
        router.refresh();
        return;
      }
      setMessage(
        response.status === 409
          ? "A newer revision exists. Your reason is still here; reload before trying again."
          : "Restore could not be confirmed. Your reason is still here. Retry unchanged to check the same restore.",
      );
    } catch (error) {
      const expired =
        error instanceof Error && error.message === "session_expired";
      setSessionExpired(expired);
      setMessage(
        expired
          ? "Your session ended. Your restore reason is still here. Sign in in a separate tab, then return and retry."
          : "Restore could not be confirmed. Your reason is still here. Retry unchanged to check the same restore.",
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  return (
    <section
      className="draft-finalization-form"
      aria-labelledby="history-title"
      aria-busy={busy}
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
            <time dateTime={revision.createdAt}>
              {new Date(revision.createdAt).toLocaleString()}
            </time>
            <div className="go-ui">
              <Button
                variant="outline"
                type="button"
                disabled={busy || waitingForRefresh || revision.isCurrent}
                onClick={() => {
                  setSelectedRevision(revision.revisionNumber);
                  setBaseRevision(currentRevisionNumber);
                  setMessage("");
                }}
              >
                Restore this version
              </Button>
            </div>
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
              disabled={busy}
              required
              maxLength={500}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          <div className="go-ui">
            <Button
              disabled={busy || waitingForRefresh || !reason.trim()}
              type="submit"
            >
              {busy ? "Saving restore…" : "Create restored revision"}
            </Button>
          </div>
        </form>
      ) : null}
      <p aria-live="polite" className="workspace-status-message">
        {message}
      </p>
      {sessionExpired ? (
        <a href="/login" target="_blank" rel="noopener noreferrer">
          Sign in again (opens a new tab)
        </a>
      ) : null}
    </section>
  );
}
