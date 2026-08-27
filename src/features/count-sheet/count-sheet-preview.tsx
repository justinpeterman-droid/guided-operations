"use client";

import { useMemo, useState } from "react";

import {
  calculateCountTotals,
  createBlankCountPayload,
  parseCountValue,
} from "./calculations";
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
  const totals = useMemo(
    () => calculateCountTotals(structure, payload),
    [payload, structure],
  );

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
        <div className="count-sheet-table-wrap">
          <table>
            <caption>Out-of-housing count by fictional area and unit</caption>
            <thead>
              <tr>
                <th scope="col">Area</th>
                {structure.columns.map((column) => (
                  <th key={column} scope="col">
                    {column}
                  </th>
                ))}
                <th scope="col">Area total</th>
              </tr>
            </thead>
            <tbody>
              {structure.areas.map((area) => (
                <tr key={area}>
                  <th scope="row">{area}</th>
                  {structure.columns.map((column) => (
                    <td key={column}>
                      {renderCountInput(
                        { group: "cell", area, field: column },
                        `${area}, ${column}`,
                      )}
                    </td>
                  ))}
                  <td className="count-total">{totals.row_totals[area]}</td>
                </tr>
              ))}
              <tr className="count-sheet-subtotal">
                <th scope="row">Out of housing</th>
                {structure.columns.map((column) => (
                  <td key={column}>{totals.out_of_housing[column]}</td>
                ))}
                <td aria-hidden="true">—</td>
              </tr>
              <tr>
                <th scope="row">In housing</th>
                {structure.columns.map((column) => (
                  <td key={column}>
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
                  <td key={column}>{totals.unit_totals[column]}</td>
                ))}
                <td>{totals.housing_total}</td>
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
            <div className={totals.reconciled ? "is-reconciled" : "is-open"}>
              <dt>Difference</dt>
              <dd>{totals.difference}</dd>
            </div>
          </dl>
          <p
            className={
              totals.reconciled
                ? "count-status is-reconciled"
                : "count-status is-open"
            }
            role="status"
          >
            {totals.reconciled
              ? "Reconciled — review before any future save."
              : "Open difference — review the values; do not balance by guessing."}
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
