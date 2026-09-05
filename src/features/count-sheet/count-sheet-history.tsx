"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useIdempotentRequest } from "@/app/components/use-idempotent-request";

import { calculateCountTotals, validateCountPayload } from "./calculations";
import { APPROVED_COUNT_SHEET_STRUCTURE } from "./approved-structure";
import type { CountSheetPayload, CountSheetTotals } from "./types";

type RevisionSummary = Readonly<{
  revisionNumber: number;
  reason: string;
  validation: CountSheetTotals;
  createdAt: string;
  isCurrent: boolean;
  restoredFromRevisionNumber: number | null;
}>;

export type ReviewedCountSheetRevision = Readonly<{
  revisionNumber: number;
  reason: string;
  payload: CountSheetPayload;
  createdAt: string;
}>;

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

function parseList(value: unknown): RevisionSummary[] {
  if (
    typeof value !== "object" ||
    value === null ||
    !("data" in value) ||
    typeof value.data !== "object" ||
    value.data === null ||
    !("revisions" in value.data) ||
    !Array.isArray(value.data.revisions)
  )
    throw new Error("history");
  return value.data.revisions.map((candidate) => {
    if (
      typeof candidate !== "object" ||
      candidate === null ||
      !("revisionNumber" in candidate) ||
      !("reason" in candidate) ||
      !("validation" in candidate) ||
      !("createdAt" in candidate) ||
      !("isCurrent" in candidate) ||
      !("restoredFromRevisionNumber" in candidate) ||
      typeof candidate.revisionNumber !== "number" ||
      !Number.isInteger(candidate.revisionNumber) ||
      candidate.revisionNumber < 1 ||
      typeof candidate.reason !== "string" ||
      typeof candidate.validation !== "object" ||
      candidate.validation === null ||
      typeof candidate.createdAt !== "string" ||
      Number.isNaN(Date.parse(candidate.createdAt)) ||
      typeof candidate.isCurrent !== "boolean" ||
      (candidate.restoredFromRevisionNumber !== null &&
        (typeof candidate.restoredFromRevisionNumber !== "number" ||
          !Number.isInteger(candidate.restoredFromRevisionNumber) ||
          candidate.restoredFromRevisionNumber < 1))
    )
      throw new Error("history");
    const validation = candidate.validation as CountSheetTotals;
    if (
      typeof validation.housing_total !== "number" ||
      typeof validation.operational_total !== "number" ||
      typeof validation.difference !== "number" ||
      typeof validation.reconciled !== "boolean"
    )
      throw new Error("history");
    return {
      revisionNumber: candidate.revisionNumber,
      reason: candidate.reason,
      validation,
      createdAt: candidate.createdAt,
      isCurrent: candidate.isCurrent,
      restoredFromRevisionNumber: candidate.restoredFromRevisionNumber,
    };
  });
}

function parseDetail(value: unknown): ReviewedCountSheetRevision {
  if (
    typeof value !== "object" ||
    value === null ||
    !("data" in value) ||
    typeof value.data !== "object" ||
    value.data === null
  )
    throw new Error("revision");
  const data = value.data;
  if (
    !("revisionNumber" in data) ||
    !("reason" in data) ||
    !("payload" in data) ||
    !("createdAt" in data) ||
    typeof data.revisionNumber !== "number" ||
    !Number.isInteger(data.revisionNumber) ||
    data.revisionNumber < 1 ||
    typeof data.reason !== "string" ||
    typeof data.createdAt !== "string" ||
    Number.isNaN(Date.parse(data.createdAt))
  )
    throw new Error("revision");
  const payload = validateCountPayload(
    APPROVED_COUNT_SHEET_STRUCTURE,
    data.payload as CountSheetPayload,
  );
  calculateCountTotals(APPROVED_COUNT_SHEET_STRUCTURE, payload);
  return {
    revisionNumber: data.revisionNumber,
    reason: data.reason,
    payload,
    createdAt: data.createdAt,
  };
}

export function CountSheetHistory({
  recordId,
  currentRevisionNumber,
  onReview,
  onRestored,
  disabled = false,
  onBusyChange,
}: Readonly<{
  recordId: string;
  currentRevisionNumber: number;
  onReview: (revision: ReviewedCountSheetRevision) => void;
  onRestored: () => void;
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
}>) {
  const [revisions, setRevisions] = useState<readonly RevisionSummary[]>([]);
  const [selectedRevision, setSelectedRevision] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("Loading revision history…");
  const [busy, updateBusy] = useState(false);
  const prepareRequest = useIdempotentRequest();
  function setBusy(value: boolean) {
    updateBusy(value);
    onBusyChange?.(value);
  }

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(
          `/api/web/v1/count-sheets/${recordId}/revisions`,
          {
            cache: "no-store",
            credentials: "same-origin",
            signal: controller.signal,
          },
        );
        const body: unknown = await response.json();
        if (!response.ok) throw new Error("history");
        setRevisions(parseList(body));
        setMessage("");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        setMessage("Revision history could not be loaded.");
      }
    })();
    return () => controller.abort();
  }, [currentRevisionNumber, recordId]);

  async function review(revisionNumber: number) {
    if (disabled || busy) return;
    setBusy(true);
    setMessage(`Loading revision ${revisionNumber}…`);
    try {
      const response = await fetch(
        `/api/web/v1/count-sheets/${recordId}/revisions?revision_number=${revisionNumber}`,
        { cache: "no-store", credentials: "same-origin" },
      );
      const body: unknown = await response.json();
      if (!response.ok) throw new Error("revision");
      const revision = parseDetail(body);
      if (revision.revisionNumber !== revisionNumber)
        throw new Error("revision");
      onReview(revision);
      setMessage(`Revision ${revisionNumber} is shown above for review.`);
    } catch {
      setMessage("That revision could not be loaded. Nothing was changed.");
    } finally {
      setBusy(false);
    }
  }

  async function restore(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled || !selectedRevision || !reason.trim() || busy) return;
    setBusy(true);
    setMessage("Creating a restored revision…");
    try {
      const request = prepareRequest(
        JSON.stringify({
          baseRevisionNumber: currentRevisionNumber,
          restoreRevisionNumber: selectedRevision,
          reason: reason.trim(),
        }),
      );
      const token = await csrfToken();
      const response = await fetch(
        `/api/web/v1/count-sheets/${recordId}/restore`,
        {
          method: "POST",
          cache: "no-store",
          credentials: "same-origin",
          headers: {
            "content-type": "application/json",
            "idempotency-key": request.key,
            "x-csrf-token": token,
          },
          body: request.body,
        },
      );
      const body: unknown = await response.json();
      if (!response.ok) {
        setMessage(
          response.status === 409
            ? "A newer revision exists. Reload the saved date before restoring."
            : "Restore could not be confirmed. Retry with the same revision and reason to check the same request.",
        );
        return;
      }
      if (
        typeof body !== "object" ||
        body === null ||
        !("data" in body) ||
        typeof body.data !== "object" ||
        body.data === null ||
        !("revisionNumber" in body.data) ||
        typeof body.data.revisionNumber !== "number" ||
        !Number.isInteger(body.data.revisionNumber) ||
        body.data.revisionNumber !== currentRevisionNumber + 1
      )
        throw new Error("restore");
      setSelectedRevision(null);
      setReason("");
      onRestored();
    } catch {
      setMessage(
        "Restore could not be confirmed. Retry with the same revision and reason to check the same request.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="draft-finalization-form"
      aria-labelledby="count-history-title"
    >
      <h2 id="count-history-title">Revision history</h2>
      <p>
        Every saved version remains preserved. Restoring creates a new version;
        it never replaces the old one.
      </p>
      {disabled ? (
        <p>
          Save your counts or finish the current sheet action before reviewing
          or restoring history.
        </p>
      ) : null}
      <ol className="report-history-list">
        {revisions.map((revision) => (
          <li key={revision.revisionNumber}>
            <strong>
              Revision {revision.revisionNumber}
              {revision.isCurrent ? " (current)" : ""}
            </strong>
            <span>
              {revision.restoredFromRevisionNumber
                ? `Restored from revision ${revision.restoredFromRevisionNumber}. `
                : ""}
              {revision.reason} Housing {revision.validation.housing_total};
              operational {revision.validation.operational_total}; difference{" "}
              {revision.validation.difference}.
            </span>
            <time dateTime={revision.createdAt}>
              {new Date(revision.createdAt).toLocaleString()}
            </time>
            <button
              disabled={busy || disabled}
              onClick={() => void review(revision.revisionNumber)}
              type="button"
            >
              Review this version
            </button>
            <button
              disabled={busy || disabled || revision.isCurrent}
              onClick={() => {
                setSelectedRevision(revision.revisionNumber);
                setMessage("");
              }}
              type="button"
            >
              Restore this version
            </button>
          </li>
        ))}
      </ol>
      {selectedRevision ? (
        <form onSubmit={restore}>
          <p>Restore revision {selectedRevision} as a new saved version.</p>
          <label>
            Restore reason
            <input
              disabled={busy || disabled}
              maxLength={500}
              onChange={(event) => setReason(event.target.value)}
              required
              value={reason}
            />
          </label>
          <button
            className="incident-primary"
            disabled={busy || disabled || !reason.trim()}
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
