"use client";

import { useEffect, useState } from "react";

import type { DailyPaperworkDocument } from "@/server/paperwork/get-daily-paperwork";
import type {
  DailyPaperworkRevisionDetail,
  DailyPaperworkRevisionSummary,
} from "@/server/paperwork/daily-paperwork-revision-history";

import {
  createBlankDailyPaperworkRow,
  parseDailyPaperworkPayload,
  type DailyPaperworkField,
  type DailyPaperworkFormSchema,
  type DailyPaperworkPayload,
  type DailyPaperworkValue,
} from "./form-schema";
import styles from "./daily-paperwork-workspace.module.css";

type State = "ready" | "saving" | "printing" | "restoring" | "error";

export function DailyPaperworkWorkspace({
  initialPaperwork,
}: Readonly<{ initialPaperwork: DailyPaperworkDocument }>) {
  const [payload, setPayload] = useState(initialPaperwork.payload);
  const [recordId, setRecordId] = useState(initialPaperwork.recordId);
  const [revisionNumber, setRevisionNumber] = useState(
    initialPaperwork.currentRevisionNumber,
  );
  const [dirty, setDirty] = useState(false);
  const [state, setState] = useState<State>("ready");
  const [message, setMessage] = useState(
    initialPaperwork.recordId
      ? `Saved revision ${initialPaperwork.currentRevisionNumber} loaded.`
      : "Approved blank form loaded. Enter only known information.",
  );
  const [reviewed, setReviewed] = useState<DailyPaperworkRevisionDetail | null>(
    null,
  );
  const [historyVersion, setHistoryVersion] = useState(0);
  const displayedSchema = reviewed?.fieldSchema ?? initialPaperwork.fieldSchema;
  const displayedPayload = reviewed?.payload ?? payload;
  const canEdit =
    initialPaperwork.editable && reviewed === null && state === "ready";

  function changeField(key: string, value: DailyPaperworkValue) {
    setPayload((current) => ({
      ...current,
      fields: { ...current.fields, [key]: value },
    }));
    markDirty();
  }

  function changeTableField(
    tableKey: string,
    rowIndex: number,
    key: string,
    value: DailyPaperworkValue,
  ) {
    setPayload((current) => ({
      ...current,
      tables: {
        ...current.tables,
        [tableKey]: current.tables[tableKey].map((row, index) =>
          index === rowIndex ? { ...row, [key]: value } : row,
        ),
      },
    }));
    markDirty();
  }

  function addRow(tableKey: string, fields: readonly DailyPaperworkField[]) {
    setPayload((current) => ({
      ...current,
      tables: {
        ...current.tables,
        [tableKey]: [
          ...current.tables[tableKey],
          createBlankDailyPaperworkRow(fields),
        ],
      },
    }));
    markDirty();
  }

  function removeRow(tableKey: string, rowIndex: number) {
    setPayload((current) => ({
      ...current,
      tables: {
        ...current.tables,
        [tableKey]: current.tables[tableKey].filter(
          (_, index) => index !== rowIndex,
        ),
      },
    }));
    markDirty();
  }

  function markDirty() {
    setDirty(true);
    setMessage("Unsaved changes.");
  }

  async function save() {
    if (!canEdit || !dirty) return;
    setState("saving");
    setMessage("Saving a new protected revision…");
    try {
      const validated = parseDailyPaperworkPayload(
        initialPaperwork.fieldSchema,
        payload,
      );
      const token = await csrfToken();
      const response = await fetch("/api/web/v1/daily-paperwork", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: mutationHeaders(token),
        body: JSON.stringify({
          kind: initialPaperwork.kind,
          workDate: initialPaperwork.workDate,
          shiftCode: initialPaperwork.shiftCode,
          baseRevisionNumber: revisionNumber,
          payload: validated,
          reason:
            revisionNumber === 0
              ? "Initial Daily Paperwork save."
              : "Daily Paperwork update.",
        }),
      });
      const body = await response.json();
      if (response.status === 409) {
        setState("ready");
        setMessage(
          "A newer revision exists. Your entries remain here; reload before saving again.",
        );
        return;
      }
      if (response.status === 423) {
        setState("ready");
        setMessage(
          "This source version is now read-only. Your entries were not saved.",
        );
        return;
      }
      const saved = parseSavedResponse(response.ok, body);
      setRecordId(saved.recordId);
      setRevisionNumber(saved.revisionNumber);
      setDirty(false);
      setState("ready");
      setHistoryVersion((version) => version + 1);
      setMessage(`Saved as revision ${saved.revisionNumber}.`);
    } catch (error) {
      setState("ready");
      setMessage(
        error instanceof Error && error.message.includes("required")
          ? error.message
          : "The form could not be saved. Your entries remain on this screen.",
      );
    }
  }

  async function printSaved() {
    if (!recordId || revisionNumber < 1 || dirty || state !== "ready") return;
    setState("printing");
    setMessage("Recording the print request…");
    try {
      const token = await csrfToken();
      const response = await fetch(
        `/api/web/v1/daily-paperwork/${recordId}/print`,
        {
          method: "POST",
          cache: "no-store",
          credentials: "same-origin",
          headers: mutationHeaders(token),
          body: JSON.stringify({ revisionNumber }),
        },
      );
      if (response.status === 409) {
        setState("ready");
        setMessage("A newer saved revision exists. Reload before printing.");
        return;
      }
      if (!response.ok) throw new Error("print");
      setState("ready");
      setMessage("Print request recorded. Opening the print dialog.");
      window.print();
    } catch {
      setState("ready");
      setMessage(
        "The print request could not be recorded, so printing did not open.",
      );
    }
  }

  return (
    <section
      className={styles.workspace}
      aria-labelledby="daily-form-title"
      data-orientation={initialPaperwork.printOrientation}
    >
      <div className={`${styles.toolbar} ${styles.noPrint}`}>
        <div>
          <p className="eyebrow">
            Shift {initialPaperwork.shiftCode} · {initialPaperwork.workDate}
          </p>
          <h1 id="daily-form-title">{initialPaperwork.title}</h1>
          <p className={styles.muted}>
            Source {initialPaperwork.sourceRevision} · Template version{" "}
            {reviewed?.templateVersion ?? initialPaperwork.templateVersion}
          </p>
        </div>
        <div className={styles.toolbarActions}>
          <button
            className={styles.primaryButton}
            disabled={!canEdit || !dirty}
            onClick={() => void save()}
            type="button"
          >
            Save new revision
          </button>
          <button
            disabled={
              !recordId ||
              revisionNumber < 1 ||
              dirty ||
              reviewed !== null ||
              state !== "ready" ||
              !initialPaperwork.capabilities.includes("print")
            }
            onClick={() => void printSaved()}
            type="button"
          >
            Print saved form
          </button>
          {reviewed ? (
            <button
              onClick={() => {
                setReviewed(null);
                setMessage(`Saved revision ${revisionNumber} is shown.`);
              }}
              type="button"
            >
              Return to current version
            </button>
          ) : null}
          <button onClick={() => window.location.reload()} type="button">
            {dirty
              ? "Reload saved form (discard entries)"
              : "Reload saved form"}
          </button>
        </div>
      </div>

      <div
        className={styles.status}
        data-tone={initialPaperwork.editable ? "normal" : "warning"}
        role="status"
      >
        <strong>{message}</strong>{" "}
        {!initialPaperwork.editable
          ? "This historical source version can be reviewed and restored, but not edited."
          : "Every save creates a new version; nothing is overwritten."}
      </div>

      <FormBody
        disabled={!canEdit}
        onAddRow={addRow}
        onChangeField={changeField}
        onChangeTableField={changeTableField}
        onRemoveRow={removeRow}
        payload={displayedPayload}
        schema={displayedSchema}
      />

      {recordId ? (
        <DailyPaperworkHistory
          currentRevisionNumber={revisionNumber}
          historyVersion={historyVersion}
          onMessage={setMessage}
          onRestored={() => window.location.reload()}
          onReview={setReviewed}
          recordId={recordId}
          setState={setState}
          state={state}
        />
      ) : null}
    </section>
  );
}

function FormBody({
  schema,
  payload,
  disabled,
  onChangeField,
  onChangeTableField,
  onAddRow,
  onRemoveRow,
}: Readonly<{
  schema: DailyPaperworkFormSchema;
  payload: DailyPaperworkPayload;
  disabled: boolean;
  onChangeField(key: string, value: DailyPaperworkValue): void;
  onChangeTableField(
    tableKey: string,
    rowIndex: number,
    key: string,
    value: DailyPaperworkValue,
  ): void;
  onAddRow(tableKey: string, fields: readonly DailyPaperworkField[]): void;
  onRemoveRow(tableKey: string, rowIndex: number): void;
}>) {
  return (
    <div className={styles.formBody}>
      {schema.fields.length ? (
        <section className={styles.fieldSection} aria-label="Form details">
          <div className={styles.fieldGrid}>
            {schema.fields.map((field) => (
              <DynamicField
                disabled={disabled}
                field={field}
                key={field.key}
                onChange={(value) => onChangeField(field.key, value)}
                value={payload.fields[field.key]}
              />
            ))}
          </div>
        </section>
      ) : null}

      {schema.tables.map((table) => {
        const rows = payload.tables[table.key];
        return (
          <section className={styles.tableSection} key={table.key}>
            <div className={styles.tableHeader}>
              <div>
                <h2>{table.label}</h2>
                {table.help_text ? <p>{table.help_text}</p> : null}
              </div>
              <button
                className={styles.noPrint}
                disabled={disabled || rows.length >= table.max_rows}
                onClick={() => onAddRow(table.key, table.columns)}
                type="button"
              >
                Add row
              </button>
            </div>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    {table.columns.map((column) => (
                      <th key={column.key} scope="col">
                        {column.label}
                      </th>
                    ))}
                    <th className={styles.noPrint} scope="col">
                      Row
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, rowIndex) => (
                    <tr key={`${table.key}-${rowIndex}`}>
                      {table.columns.map((column) => (
                        <td key={column.key}>
                          <DynamicField
                            compact
                            disabled={disabled}
                            field={column}
                            onChange={(value) =>
                              onChangeTableField(
                                table.key,
                                rowIndex,
                                column.key,
                                value,
                              )
                            }
                            value={row[column.key]}
                          />
                        </td>
                      ))}
                      <td className={styles.noPrint}>
                        <button
                          disabled={disabled || rows.length <= table.min_rows}
                          onClick={() => onRemoveRow(table.key, rowIndex)}
                          type="button"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={table.columns.length + 1}>
                        No rows entered.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}

function DynamicField({
  field,
  value,
  disabled,
  compact = false,
  onChange,
}: Readonly<{
  field: DailyPaperworkField;
  value: DailyPaperworkValue;
  disabled: boolean;
  compact?: boolean;
  onChange(value: DailyPaperworkValue): void;
}>) {
  const control = renderControl(field, value, disabled, onChange);
  if (compact)
    return (
      <label className={styles.field}>
        <span className="sr-only">{field.label}</span>
        {control}
      </label>
    );
  return (
    <label className={styles.field}>
      <span>
        {field.label}
        {field.required ? " *" : ""}
      </span>
      {field.help_text ? <small>{field.help_text}</small> : null}
      {control}
    </label>
  );
}

function renderControl(
  field: DailyPaperworkField,
  value: DailyPaperworkValue,
  disabled: boolean,
  onChange: (value: DailyPaperworkValue) => void,
) {
  if (field.type === "boolean")
    return (
      <select
        aria-label={field.label}
        disabled={disabled}
        onChange={(event) =>
          onChange(
            event.target.value === "" ? null : event.target.value === "true",
          )
        }
        value={value === null ? "" : value ? "true" : "false"}
      >
        <option value="">Not entered</option>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    );
  if (field.type === "select")
    return (
      <select
        aria-label={field.label}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value || null)}
        value={typeof value === "string" ? value : ""}
      >
        <option value="">Choose…</option>
        {field.options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  if (field.type === "text" && field.max_length > 300)
    return (
      <textarea
        className="resize-vertical"
        aria-label={field.label}
        disabled={disabled}
        maxLength={field.max_length}
        onChange={(event) => onChange(event.target.value || null)}
        value={typeof value === "string" ? value : ""}
      />
    );
  return (
    <input
      aria-label={field.label}
      disabled={disabled}
      max={field.type === "integer" ? field.maximum : undefined}
      maxLength={field.type === "text" ? field.max_length : undefined}
      min={field.type === "integer" ? field.minimum : undefined}
      onChange={(event) =>
        onChange(
          event.target.value === ""
            ? null
            : field.type === "integer"
              ? Number(event.target.value)
              : event.target.value,
        )
      }
      type={
        field.type === "integer"
          ? "number"
          : field.type === "date"
            ? "date"
            : field.type === "time"
              ? "time"
              : "text"
      }
      value={value === null ? "" : String(value)}
    />
  );
}

function DailyPaperworkHistory({
  recordId,
  currentRevisionNumber,
  historyVersion,
  state,
  setState,
  onReview,
  onRestored,
  onMessage,
}: Readonly<{
  recordId: string;
  currentRevisionNumber: number;
  historyVersion: number;
  state: State;
  setState(value: State): void;
  onReview(value: DailyPaperworkRevisionDetail): void;
  onRestored(): void;
  onMessage(value: string): void;
}>) {
  const [revisions, setRevisions] = useState<
    readonly DailyPaperworkRevisionSummary[]
  >([]);
  const [historyState, setHistoryState] = useState<
    "loading" | "ready" | "error"
  >("loading");

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(
          `/api/web/v1/daily-paperwork/${recordId}/revisions`,
          {
            cache: "no-store",
            credentials: "same-origin",
            signal: controller.signal,
          },
        );
        const body: unknown = await response.json();
        if (!response.ok || !isRecord(body) || !isRecord(body.data))
          throw new Error("history");
        const parsed = parseHistory(body.data.revisions);
        setRevisions(parsed);
        setHistoryState("ready");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        setHistoryState("error");
      }
    })();
    return () => controller.abort();
  }, [historyVersion, recordId]);

  async function review(revisionNumber: number) {
    try {
      const response = await fetch(
        `/api/web/v1/daily-paperwork/${recordId}/revisions?revision_number=${revisionNumber}`,
        { cache: "no-store", credentials: "same-origin" },
      );
      const body: unknown = await response.json();
      if (!response.ok || !isRecord(body) || !isRecord(body.data))
        throw new Error("review");
      onReview(body.data as unknown as DailyPaperworkRevisionDetail);
      onMessage(
        `Reviewing saved revision ${revisionNumber}. Nothing has been changed.`,
      );
    } catch {
      onMessage("That saved revision could not be loaded.");
    }
  }

  async function restore(revisionNumber: number) {
    if (state !== "ready") return;
    setState("restoring");
    onMessage(`Restoring revision ${revisionNumber} as a new revision…`);
    try {
      const token = await csrfToken();
      const response = await fetch(
        `/api/web/v1/daily-paperwork/${recordId}/restore`,
        {
          method: "POST",
          cache: "no-store",
          credentials: "same-origin",
          headers: mutationHeaders(token),
          body: JSON.stringify({
            baseRevisionNumber: currentRevisionNumber,
            restoreRevisionNumber: revisionNumber,
            reason: `Restored Daily Paperwork revision ${revisionNumber}.`,
          }),
        },
      );
      if (response.status === 409) {
        setState("ready");
        onMessage("A newer revision exists. Reload before restoring.");
        return;
      }
      if (!response.ok) throw new Error("restore");
      onRestored();
    } catch {
      setState("ready");
      onMessage("The older revision could not be restored.");
    }
  }

  return (
    <section className={`${styles.history} ${styles.noPrint}`}>
      <div className={styles.historyHeader}>
        <div>
          <p className="eyebrow">Revision history</p>
          <h2>Saved versions</h2>
        </div>
        <span>{historyState === "ready" ? revisions.length : "—"}</span>
      </div>
      {historyState === "error" ? (
        <p>Revision history cannot load right now.</p>
      ) : null}
      <ol className={styles.historyList}>
        {revisions.map((revision) => (
          <li className={styles.historyItem} key={revision.revisionNumber}>
            <div>
              <strong>
                Revision {revision.revisionNumber}
                {revision.isCurrent ? " · Current" : ""}
              </strong>
              <p className={styles.muted}>
                {revision.reason} · Template {revision.templateVersion}
              </p>
            </div>
            <div className={styles.historyActions}>
              <button
                disabled={state !== "ready"}
                onClick={() => void review(revision.revisionNumber)}
                type="button"
              >
                Review
              </button>
              {!revision.isCurrent ? (
                <button
                  disabled={state !== "ready"}
                  onClick={() => void restore(revision.revisionNumber)}
                  type="button"
                >
                  Restore as new revision
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

async function csrfToken(): Promise<string> {
  const response = await fetch("/api/auth/csrf", {
    cache: "no-store",
    credentials: "same-origin",
  });
  const body: unknown = await response.json();
  if (!response.ok || !isRecord(body) || typeof body.csrfToken !== "string")
    throw new Error("csrf");
  return body.csrfToken;
}

function mutationHeaders(token: string): HeadersInit {
  return {
    "content-type": "application/json",
    "idempotency-key": crypto.randomUUID().replaceAll("-", ""),
    "x-csrf-token": token,
  };
}

function parseSavedResponse(ok: boolean, body: unknown) {
  if (!ok || !isRecord(body) || !isRecord(body.data)) throw new Error("save");
  if (
    typeof body.data.recordId !== "string" ||
    typeof body.data.revisionNumber !== "number" ||
    !Number.isInteger(body.data.revisionNumber) ||
    body.data.revisionNumber < 1
  )
    throw new Error("save");
  return {
    recordId: body.data.recordId,
    revisionNumber: body.data.revisionNumber,
  };
}

function parseHistory(
  value: unknown,
): readonly DailyPaperworkRevisionSummary[] {
  if (!Array.isArray(value)) throw new Error("history");
  return value.map((item) => {
    if (
      !isRecord(item) ||
      typeof item.revisionNumber !== "number" ||
      typeof item.reason !== "string" ||
      typeof item.templateVersion !== "number" ||
      typeof item.sourceRevision !== "string" ||
      typeof item.createdAt !== "string" ||
      typeof item.isCurrent !== "boolean" ||
      (item.restoredFromRevisionNumber !== null &&
        typeof item.restoredFromRevisionNumber !== "number")
    )
      throw new Error("history");
    return item as unknown as DailyPaperworkRevisionSummary;
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
