"use client";

import { useMemo, useState } from "react";

import {
  calculateCountTotals,
  createBlankCountPayload,
  isCountSheetReconciliationComplete,
  parseCountValue,
} from "./calculations";
import { CountSheetColumnTotal } from "./count-sheet-column-total";
import { CountSheetAreaLabel } from "./count-sheet-area-label";
import printStyles from "./count-sheet-print.module.css";
import { PrintCountSheetButton } from "./print-count-sheet-button";
import type { CountSheetPayload, CountSheetStructure } from "./types";

type CountSheetPreviewProps = {
  structure: CountSheetStructure;
};

type CountCellTarget =
  | { group: "cell"; area: string; field: string }
  | { group: "housing"; field: string }
  | { group: "operational"; field: string };

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
        [target.area]: {
          ...payload.cells[target.area],
          [target.field]: value,
        },
      },
    };
  }

  const fieldGroup = target.group === "housing" ? "in_housing" : "operational";
  return {
    ...payload,
    [fieldGroup]: {
      ...payload[fieldGroup],
      [target.field]: value,
    },
  };
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

export function CountSheetPreview({ structure }: CountSheetPreviewProps) {
  const [payload, setPayload] = useState(() =>
    createBlankCountPayload(structure),
  );
  const [error, setError] = useState<string | null>(null);
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
  const totals = useMemo(
    () => calculateCountTotals(structure, payload),
    [payload, structure],
  );
  const reconciliationComplete = useMemo(
    () => isCountSheetReconciliationComplete(structure, payload),
    [payload, structure],
  );
  const reconciliationState = !reconciliationComplete
    ? "incomplete"
    : totals.reconciled
      ? "reconciled"
      : "open";

  function handleCountChange(target: CountCellTarget, rawValue: string) {
    try {
      const parsed = parseCountValue(rawValue);
      setPayload((current) => updateCountValue(current, target, parsed));
      setError(null);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Enter a whole number.",
      );
    }
  }

  function renderCountInput(target: CountCellTarget, label: string) {
    const value = valueForTarget(payload, target);
    return (
      <input
        aria-label={label}
        id={inputId(target)}
        inputMode="numeric"
        min="0"
        onChange={(event) => handleCountChange(target, event.target.value)}
        pattern="[0-9]*"
        type="text"
        value={value ?? ""}
      />
    );
  }

  return (
    <section
      className={`count-sheet-preview ${printStyles.printLayout}`}
      aria-labelledby="count-sheet-title"
    >
      <div className="count-sheet-heading">
        <div>
          <p className="eyebrow">Local calculation preview</p>
          <h1 id="count-sheet-title">{structure.title}</h1>
          <p>
            Fictional practice values stay in this browser tab. They are never
            saved or sent anywhere; any printout is marked as training only.
          </p>
        </div>
        <div className="count-sheet-heading-actions">
          <span className="not-saved-label">Not saved</span>
          <PrintCountSheetButton />
        </div>
      </div>

      <div className="fictional-notice" role="note">
        <strong>Training preview only.</strong> Blank fields remain blank; the
        sheet never invents a count to make totals reconcile.
      </div>

      <p className="count-sheet-print-watermark" aria-hidden="true">
        Fictional training preview — not an approved operational form
      </p>

      <div className="count-sheet-grid">
        <div
          aria-describedby="preview-count-scroll-cue"
          aria-label="Count entries by fictional area and unit"
          className="count-sheet-table-wrap"
          role="region"
        >
          <p className="count-sheet-scroll-cue" id="preview-count-scroll-cue">
            Swipe to view all units; area names remain visible
          </p>
          <table>
            <caption>Out-of-housing count by fictional area and unit</caption>
            <thead>
              <tr>
                <th scope="col">Area</th>
                {structure.columns.map((column) => (
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
              {structure.areas.map((area) => {
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
                    {structure.columns.map((column) => (
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
                {structure.columns.map((column) => (
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
                {structure.columns.map((column) => (
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
                {structure.columns.map((column) => (
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
                {structure.columns.map((column) => (
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
            role="status"
          >
            {reconciliationState === "reconciled"
              ? "Reconciled — review before any future save."
              : reconciliationState === "open"
                ? "Open difference — review the values; do not balance by guessing."
                : "Incomplete — enter known values to reconcile."}
          </p>
          <div className="operational-inputs">
            <h2>Operational total</h2>
            {structure.operational_fields.map((field) => (
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

      {error ? (
        <p className="count-input-error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
