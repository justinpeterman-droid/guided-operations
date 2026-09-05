"use client";

import { useEffect, useMemo, useState } from "react";
import { useUnsavedChanges } from "@/app/components/use-unsaved-changes";
import { useIdempotentRequest } from "@/app/components/use-idempotent-request";

import { CountSheetColumnTotal } from "./count-sheet-column-total";
import { CountSheetComparison } from "./count-sheet-comparison";
import { CountSheetAreaLabel } from "./count-sheet-area-label";
import {
  calculateCountTotals,
  createBlankCountPayload,
  isCountSheetReconciliationComplete,
  parseCountValue,
  validateCountPayload,
} from "./calculations";
import {
  APPROVED_COUNT_SHEET_STRUCTURE,
  isApprovedCountSheetStructure,
} from "./approved-structure";
import printStyles from "./count-sheet-print.module.css";
import { parseCountSheetStructure } from "./schema";
import { PrintCountSheetButton } from "./print-count-sheet-button";
import {
  CountSheetHistory,
  type ReviewedCountSheetRevision,
} from "./count-sheet-history";
import type { CountSheetPayload } from "./types";

type ShiftCode = "A" | "B" | "C" | "D" | "U" | "F";
type CountCellTarget =
  | { group: "cell"; area: string; field: string }
  | { group: "housing"; field: string }
  | { group: "operational"; field: string };

type LoadedSheet = Readonly<{
  recordId: string | null;
  workDate: string;
  shiftCode: ShiftCode;
  revisionNumber: number;
  payload: CountSheetPayload;
  updatedAt: string | null;
}>;

function updateCountValue(
  payload: CountSheetPayload,
  target: CountCellTarget,
  value: number | null,
): CountSheetPayload {
  if (target.group === "cell") {
    return {
      ...payload,
      cells: {
        ...payload.cells,
        [target.area]: { ...payload.cells[target.area], [target.field]: value },
      },
    };
  }
  const group = target.group === "housing" ? "in_housing" : "operational";
  return { ...payload, [group]: { ...payload[group], [target.field]: value } };
}

function valueForTarget(payload: CountSheetPayload, target: CountCellTarget) {
  if (target.group === "cell") return payload.cells[target.area][target.field];
  if (target.group === "housing") return payload.in_housing[target.field];
  return payload.operational[target.field];
}

function inputId(target: CountCellTarget): string {
  if (target.group === "cell") return `count-${target.area}-${target.field}`;
  return `count-${target.group}-${target.field}`;
}

async function csrfToken(): Promise<string> {
  const response = await fetch("/api/auth/csrf", {
    cache: "no-store",
    credentials: "same-origin",
  });
  if (response.status === 401) throw new Error("session_expired");
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

function parseLoadedSheet(
  value: unknown,
  expectedShift: ShiftCode,
): LoadedSheet {
  if (typeof value !== "object" || value === null || !("data" in value))
    throw new Error("response");
  const data = value.data;
  if (
    typeof data !== "object" ||
    data === null ||
    !("recordId" in data) ||
    !("workDate" in data) ||
    !("shiftCode" in data) ||
    !("revisionNumber" in data) ||
    !("structure" in data) ||
    !("payload" in data) ||
    !("updatedAt" in data) ||
    (data.recordId !== null && typeof data.recordId !== "string") ||
    typeof data.workDate !== "string" ||
    data.shiftCode !== expectedShift ||
    typeof data.revisionNumber !== "number" ||
    !Number.isInteger(data.revisionNumber) ||
    data.revisionNumber < 0 ||
    (data.updatedAt !== null && typeof data.updatedAt !== "string")
  )
    throw new Error("response");
  const structure = parseCountSheetStructure(data.structure);
  if (!isApprovedCountSheetStructure(structure)) throw new Error("structure");
  const payload = validateCountPayload(
    structure,
    data.payload as CountSheetPayload,
  );
  calculateCountTotals(structure, payload);
  return {
    recordId: data.recordId,
    workDate: data.workDate,
    shiftCode: expectedShift,
    revisionNumber: data.revisionNumber,
    payload,
    updatedAt: data.updatedAt,
  };
}

export function CountSheetWorkspace({
  initialWorkDate,
  shiftCode,
}: Readonly<{ initialWorkDate: string; shiftCode: ShiftCode }>) {
  const [workDate, setWorkDate] = useState(initialWorkDate);
  const [selectedWorkDate, setSelectedWorkDate] = useState(initialWorkDate);
  const dateSelectionPending = selectedWorkDate !== workDate;
  const [payload, setPayload] = useState(() =>
    createBlankCountPayload(APPROVED_COUNT_SHEET_STRUCTURE),
  );
  const [recordId, setRecordId] = useState<string | null>(null);
  const [revisionNumber, setRevisionNumber] = useState(0);
  const [loadVersion, setLoadVersion] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [historyBusy, setHistoryBusy] = useState(false);
  const prepareRequest = useIdempotentRequest();
  const [sessionExpired, setSessionExpired] = useState(false);
  useUnsavedChanges(dirty);
  const [reviewedRevision, setReviewedRevision] =
    useState<ReviewedCountSheetRevision | null>(null);
  const [state, setState] = useState<
    "loading" | "ready" | "saving" | "printing" | "error"
  >("loading");
  const [message, setMessage] = useState("Loading your shift Count Sheet…");
  const [inputError, setInputError] = useState<string | null>(null);
  const [flaggedColumns, setFlaggedColumns] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  function toggleColumn(column: string) {
    setFlaggedColumns((current) => {
      const next = new Set(current);
      if (next.has(column)) next.delete(column);
      else next.add(column);
      return next;
    });
  }
  const [flaggedAreas, setFlaggedAreas] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const displayedPayload = reviewedRevision?.payload ?? payload;
  const totals = useMemo(
    () =>
      calculateCountTotals(APPROVED_COUNT_SHEET_STRUCTURE, displayedPayload),
    [displayedPayload],
  );
  const reconciliationComplete = useMemo(
    () =>
      isCountSheetReconciliationComplete(
        APPROVED_COUNT_SHEET_STRUCTURE,
        displayedPayload,
      ),
    [displayedPayload],
  );
  const reconciliationState = !reconciliationComplete
    ? "incomplete"
    : totals.reconciled
      ? "reconciled"
      : "open";

  useEffect(() => {
    if (!workDate) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(
          `/api/web/v1/count-sheets?work_date=${encodeURIComponent(workDate)}`,
          {
            cache: "no-store",
            credentials: "same-origin",
            signal: controller.signal,
          },
        );
        const body: unknown = await response.json();
        if (!response.ok) throw new Error("load");
        const loaded = parseLoadedSheet(body, shiftCode);
        if (loaded.workDate !== workDate) throw new Error("date");
        setPayload(loaded.payload);
        setRecordId(loaded.recordId);
        setRevisionNumber(loaded.revisionNumber);
        setReviewedRevision(null);
        setFlaggedAreas(new Set());
        setFlaggedColumns(new Set());
        setDirty(false);
        setInputError(null);
        setState("ready");
        setMessage(
          loaded.recordId
            ? `Saved revision ${loaded.revisionNumber} loaded.`
            : "No saved sheet exists for this date. Start with the blank approved form.",
        );
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        setState("error");
        setMessage("The Count Sheet could not be loaded. No work was changed.");
      }
    })();
    return () => controller.abort();
  }, [loadVersion, shiftCode, workDate]);

  function changeCount(target: CountCellTarget, raw: string) {
    try {
      const value = parseCountValue(raw);
      setPayload((current) => updateCountValue(current, target, value));
      setDirty(true);
      setInputError(null);
      setMessage("Unsaved changes.");
    } catch (error) {
      setInputError(
        error instanceof Error ? error.message : "Enter a whole number.",
      );
    }
  }

  function changeTime(field: "count_started" | "count_ended", value: string) {
    setPayload((current) => ({ ...current, [field]: value || null }));
    setDirty(true);
    setInputError(null);
    setMessage("Unsaved changes.");
  }

  async function save() {
    if (
      !workDate ||
      historyBusy ||
      dateSelectionPending ||
      state !== "ready" ||
      !dirty
    )
      return;
    setState("saving");
    setSessionExpired(false);
    setMessage("Saving a new revision…");
    try {
      validateCountPayload(APPROVED_COUNT_SHEET_STRUCTURE, payload);
      const request = prepareRequest(
        JSON.stringify({
          workDate,
          baseRevisionNumber: revisionNumber,
          structure: APPROVED_COUNT_SHEET_STRUCTURE,
          payload,
          reason:
            revisionNumber === 0
              ? "Initial shift Count Sheet."
              : "Shift Count Sheet update.",
        }),
      );
      const token = await csrfToken();
      const response = await fetch("/api/web/v1/count-sheets", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          "content-type": "application/json",
          "idempotency-key": request.key,
          "x-csrf-token": token,
        },
        body: request.body,
      });
      if (response.status === 401) throw new Error("session_expired");
      const body: unknown = await response.json();
      if (response.status === 409) {
        setState("ready");
        setMessage(
          "A newer revision exists. Your entries remain here; reload the date before saving again.",
        );
        return;
      }
      if (
        !response.ok ||
        typeof body !== "object" ||
        body === null ||
        !("data" in body) ||
        typeof body.data !== "object" ||
        body.data === null ||
        !("recordId" in body.data) ||
        !("revisionNumber" in body.data) ||
        typeof body.data.recordId !== "string" ||
        typeof body.data.revisionNumber !== "number"
      )
        throw new Error("save");
      setRecordId(body.data.recordId);
      setRevisionNumber(body.data.revisionNumber);
      setDirty(false);
      setState("ready");
      setMessage(`Saved as revision ${body.data.revisionNumber}.`);
    } catch (error) {
      setState("ready");
      const expired =
        error instanceof Error && error.message === "session_expired";
      setSessionExpired(expired);
      setMessage(
        expired
          ? "Your session ended. Your entries are still here. Sign in again in a separate tab, then return here and save."
          : "Save could not be confirmed. Your entries remain here. Retry without changing them to check the same save.",
      );
    }
  }

  async function preparePrint(): Promise<boolean> {
    if (!recordId || revisionNumber < 1 || dirty || state !== "ready")
      return false;
    setState("printing");
    setMessage("Recording the print request…");
    try {
      const token = await csrfToken();
      const response = await fetch(
        `/api/web/v1/count-sheets/${recordId}/print`,
        {
          method: "POST",
          cache: "no-store",
          credentials: "same-origin",
          headers: {
            "content-type": "application/json",
            "idempotency-key": crypto.randomUUID().replaceAll("-", ""),
            "x-csrf-token": token,
          },
          body: JSON.stringify({ revisionNumber }),
        },
      );
      const body: unknown = await response.json();
      if (response.status === 409) {
        setState("ready");
        setMessage(
          "A newer saved revision exists. Reload the date before printing.",
        );
        return false;
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
      setState("ready");
      setMessage("Print request recorded. Opening the browser print dialog.");
      return true;
    } catch {
      setState("ready");
      setMessage(
        "The print request could not be recorded, so no print dialog was opened.",
      );
      return false;
    }
  }

  function renderCountInput(target: CountCellTarget, label: string) {
    const value = valueForTarget(displayedPayload, target);
    return (
      <input
        aria-label={label}
        disabled={
          state !== "ready" ||
          historyBusy ||
          dateSelectionPending ||
          reviewedRevision !== null
        }
        id={inputId(target)}
        inputMode="numeric"
        min="0"
        onChange={(event) => changeCount(target, event.target.value)}
        pattern="[0-9]*"
        type="text"
        value={value ?? ""}
      />
    );
  }

  return (
    <section
      aria-busy={state === "loading"}
      className={`count-sheet-preview ${printStyles.printLayout}${state === "loading" ? " is-loading" : ""}`}
      aria-labelledby="count-sheet-title"
    >
      <div className="count-sheet-heading">
        <div>
          <p className="eyebrow">Protected shift record · Shift {shiftCode}</p>
          <h1 id="count-sheet-title">{APPROVED_COUNT_SHEET_STRUCTURE.title}</h1>
          <p>
            {reviewedRevision
              ? `Reviewing preserved revision ${reviewedRevision.revisionNumber}. Return to the current version before editing.`
              : "Enter known values, review the difference, and save. Every save creates a new revision."}
          </p>
        </div>
        <div className="count-sheet-heading-actions">
          <span className="not-saved-label">
            {state === "saving"
              ? "Saving"
              : dirty
                ? "Not saved"
                : reviewedRevision
                  ? `Reviewing r${reviewedRevision.revisionNumber}`
                  : recordId
                    ? `Saved r${revisionNumber}`
                    : "Blank"}
          </span>
          <button
            className="count-sheet-print-button"
            disabled={
              state !== "ready" ||
              historyBusy ||
              dateSelectionPending ||
              !dirty ||
              reviewedRevision !== null
            }
            onClick={() => void save()}
            type="button"
          >
            Save new revision
          </button>
          <PrintCountSheetButton
            disabled={
              dirty ||
              dateSelectionPending ||
              historyBusy ||
              !recordId ||
              state !== "ready" ||
              reviewedRevision !== null
            }
            label="Print saved sheet"
            onBeforePrint={preparePrint}
          />
          <button
            className="count-sheet-print-button"
            disabled={state === "saving" || state === "printing" || historyBusy}
            onClick={() => {
              if (
                dirty &&
                !window.confirm(
                  "Discard your unsaved counts and reload the saved sheet?",
                )
              )
                return;
              setState("loading");
              setMessage("Loading your shift Count Sheet…");
              setLoadVersion((current) => current + 1);
            }}
            type="button"
          >
            {dirty
              ? "Reload saved date (discard entries)"
              : "Reload saved date"}
          </button>
          {reviewedRevision ? (
            <button
              className="count-sheet-print-button"
              disabled={historyBusy}
              onClick={() => {
                setReviewedRevision(null);
                setMessage(`Saved revision ${revisionNumber} is shown.`);
              }}
              type="button"
            >
              Return to current version
            </button>
          ) : null}
        </div>
      </div>

      <div
        className={
          state === "loading"
            ? "fictional-notice count-sheet-loading-notice"
            : "fictional-notice"
        }
        role="status"
      >
        <strong>{message}</strong> Do not guess a number just to make the sheet
        balance.
      </div>
      {sessionExpired ? (
        <p>
          <a
            className="reports-home-link"
            href="/login"
            target="_blank"
            rel="noopener noreferrer"
          >
            Sign in again (opens a new tab)
          </a>
        </p>
      ) : null}

      {reviewedRevision ? (
        <CountSheetComparison
          current={payload}
          reviewed={reviewedRevision.payload}
          currentRevision={revisionNumber}
          reviewedRevision={reviewedRevision.revisionNumber}
        />
      ) : null}
      <div className="count-sheet-grid">
        <div
          aria-describedby="count-scroll-cue"
          aria-label="Count entries by area and unit"
          className="count-sheet-table-wrap"
          role="region"
        >
          <p className="count-sheet-scroll-cue" id="count-scroll-cue">
            Swipe to view all units; area names remain visible
          </p>
          <table>
            <caption>Out-of-housing count by area and unit</caption>
            <thead>
              <tr>
                <th scope="col">Area</th>
                {APPROVED_COUNT_SHEET_STRUCTURE.columns.map((column) => (
                  <th
                    key={column}
                    scope="col"
                    className={
                      flaggedColumns.has(column)
                        ? "count-sheet-column-flagged"
                        : undefined
                    }
                  >
                    {column}
                  </th>
                ))}
                <th scope="col">Area total</th>
              </tr>
            </thead>
            <tbody>
              {APPROVED_COUNT_SHEET_STRUCTURE.areas.map((area) => {
                const flagged = flaggedAreas.has(area);
                return (
                  <tr
                    className={flagged ? "count-sheet-row-flagged" : undefined}
                    key={area}
                  >
                    <CountSheetAreaLabel
                      area={area}
                      flagged={flagged}
                      onToggle={() => {
                        setFlaggedAreas((current) => {
                          const next = new Set(current);
                          if (next.has(area)) next.delete(area);
                          else next.add(area);
                          return next;
                        });
                      }}
                    />
                    {APPROVED_COUNT_SHEET_STRUCTURE.columns.map((column) => (
                      <td
                        key={column}
                        className={
                          flaggedColumns.has(column)
                            ? "count-sheet-column-flagged"
                            : undefined
                        }
                      >
                        {renderCountInput(
                          { group: "cell", area, field: column },
                          `${area}, ${column}`,
                        )}
                      </td>
                    ))}
                    <td className="count-total">{totals.row_totals[area]}</td>
                  </tr>
                );
              })}
              <tr className="count-sheet-subtotal">
                <th scope="row">Out of housing</th>
                {APPROVED_COUNT_SHEET_STRUCTURE.columns.map((column) => (
                  <td
                    key={column}
                    className={
                      flaggedColumns.has(column)
                        ? "count-sheet-column-flagged"
                        : undefined
                    }
                  >
                    {totals.out_of_housing[column]}
                  </td>
                ))}
                <td aria-hidden="true">—</td>
              </tr>
              <tr>
                <th scope="row">In housing</th>
                {APPROVED_COUNT_SHEET_STRUCTURE.columns.map((column) => (
                  <td
                    key={column}
                    className={
                      flaggedColumns.has(column)
                        ? "count-sheet-column-flagged"
                        : undefined
                    }
                  >
                    {renderCountInput(
                      { group: "housing", field: column },
                      `In housing, ${column}`,
                    )}
                  </td>
                ))}
                <td aria-hidden="true">—</td>
              </tr>
              <tr className="count-sheet-total-row">
                <th scope="row">Housing total</th>
                {APPROVED_COUNT_SHEET_STRUCTURE.columns.map((column) => (
                  <CountSheetColumnTotal
                    key={column}
                    column={column}
                    total={totals.unit_totals[column]}
                    flagged={flaggedColumns.has(column)}
                    onToggle={() => toggleColumn(column)}
                  />
                ))}
                <td>{totals.housing_total}</td>
              </tr>
              <tr className="count-sheet-unit-label-row">
                <td />
                {APPROVED_COUNT_SHEET_STRUCTURE.columns.map((column) => (
                  <td key={column}>{column}</td>
                ))}
                <td />
              </tr>
            </tbody>
          </table>
        </div>

        <aside
          className="count-sheet-summary"
          aria-label="Count reconciliation"
        >
          <p className="eyebrow">Reconciliation</p>
          <dl>
            <div>
              <dt>Housing total</dt>
              <dd>{totals.housing_total}</dd>
            </div>
            <div>
              <dt>Operational total</dt>
              <dd>{totals.operational_total}</dd>
            </div>
            <div
              className={`count-sheet-difference ${totals.difference !== 0 ? "has-difference" : ""}`}
            >
              <dt>
                {reconciliationState === "incomplete"
                  ? "Current difference"
                  : "Difference"}
                <span>Housing − operational</span>
              </dt>
              <dd>
                {totals.difference > 0 ? "+" : ""}
                {totals.difference}
              </dd>
            </div>
          </dl>
          <p
            className={
              reconciliationState === "reconciled"
                ? "count-status is-reconciled"
                : reconciliationState === "open"
                  ? "count-status is-open"
                  : "count-status is-incomplete"
            }
          >
            {reconciliationState === "reconciled"
              ? "Reconciled — review before saving."
              : reconciliationState === "open"
                ? "Open difference — review the values."
                : "Incomplete — enter known values to reconcile."}
          </p>
          <div className="operational-inputs">
            <h2>Sheet details</h2>
            <p>
              {state === "loading" || state === "error"
                ? "Requested sheet"
                : "Loaded sheet"}
              : {workDate} · Shift {shiftCode}
            </p>
            <label>
              Work date
              <input
                aria-label="Work date"
                disabled={
                  (state !== "ready" && state !== "error") ||
                  historyBusy ||
                  dirty ||
                  reviewedRevision !== null
                }
                onChange={(event) => {
                  setSelectedWorkDate(event.target.value);
                }}
                type="date"
                value={selectedWorkDate}
              />
            </label>
            {dateSelectionPending ? (
              <div>
                <p role="status">
                  Choose a complete date, then load its sheet to enter counts.
                </p>
                <div className="count-sheet-date-actions">
                  <button
                    className="count-sheet-print-button"
                    disabled={
                      !/^\d{4}-\d{2}-\d{2}$/.test(selectedWorkDate) ||
                      (state !== "ready" && state !== "error") ||
                      dirty
                    }
                    onClick={() => {
                      setState("loading");
                      setMessage("Loading your shift Count Sheet…");
                      setWorkDate(selectedWorkDate);
                    }}
                    type="button"
                  >
                    Load date
                  </button>
                  <button
                    className="count-sheet-print-button"
                    onClick={() => setSelectedWorkDate(workDate)}
                    type="button"
                  >
                    Cancel date change
                  </button>
                </div>
              </div>
            ) : null}
            <label>
              Count started
              <input
                aria-label="Count started"
                disabled={
                  state !== "ready" ||
                  historyBusy ||
                  dateSelectionPending ||
                  reviewedRevision !== null
                }
                onChange={(event) =>
                  changeTime("count_started", event.target.value)
                }
                type="time"
                value={displayedPayload.count_started ?? ""}
              />
            </label>
            <label>
              Count ended
              <input
                aria-label="Count ended"
                disabled={
                  state !== "ready" ||
                  historyBusy ||
                  dateSelectionPending ||
                  reviewedRevision !== null
                }
                onChange={(event) =>
                  changeTime("count_ended", event.target.value)
                }
                type="time"
                value={displayedPayload.count_ended ?? ""}
              />
            </label>
            <h2>Operational total</h2>
            {APPROVED_COUNT_SHEET_STRUCTURE.operational_fields.map((field) => (
              <label key={field}>
                {field.replaceAll("_", " ")}
                {renderCountInput(
                  { group: "operational", field },
                  `Operational total, ${field.replaceAll("_", " ")}`,
                )}
              </label>
            ))}
          </div>
        </aside>
      </div>
      {inputError ? (
        <p className="count-input-error" role="alert">
          {inputError}
        </p>
      ) : null}
      {recordId && revisionNumber > 0 ? (
        <CountSheetHistory
          disabled={dirty || state !== "ready" || dateSelectionPending}
          onBusyChange={setHistoryBusy}
          currentRevisionNumber={revisionNumber}
          key={recordId}
          onRestored={() => {
            setReviewedRevision(null);
            setState("loading");
            setMessage("Loading the restored Count Sheet…");
            setLoadVersion((current) => current + 1);
          }}
          onReview={(revision) => {
            setReviewedRevision(revision);
            setMessage(
              `Reviewing saved revision ${revision.revisionNumber}. Nothing has been changed.`,
            );
          }}
          recordId={recordId}
        />
      ) : null}
    </section>
  );
}
