import { APPROVED_COUNT_SHEET_STRUCTURE as structure } from "./approved-structure";
import type { CountSheetPayload } from "./types";

type Value = string | number | null;
export function countSheetDifferences(
  current: CountSheetPayload,
  reviewed: CountSheetPayload,
) {
  const rows: { field: string; current: Value; reviewed: Value }[] = [];
  function compare(field: string, before: Value, after: Value) {
    if (before !== after)
      rows.push({ field, current: before, reviewed: after });
  }
  compare("Count started", current.count_started, reviewed.count_started);
  compare("Count ended", current.count_ended, reviewed.count_ended);
  for (const area of structure.areas)
    for (const column of structure.columns)
      compare(
        `${area}, ${column}`,
        current.cells[area][column],
        reviewed.cells[area][column],
      );
  for (const column of structure.columns)
    compare(
      `In housing, ${column}`,
      current.in_housing[column],
      reviewed.in_housing[column],
    );
  for (const field of structure.operational_fields)
    compare(
      `Operational total, ${field.replaceAll("_", " ")}`,
      current.operational[field],
      reviewed.operational[field],
    );
  return rows;
}

export function CountSheetComparison({
  current,
  reviewed,
  currentRevision,
  reviewedRevision,
}: Readonly<{
  current: CountSheetPayload;
  reviewed: CountSheetPayload;
  currentRevision: number;
  reviewedRevision: number;
}>) {
  const differences = countSheetDifferences(current, reviewed);
  return (
    <section
      className="count-sheet-comparison"
      aria-labelledby="count-comparison-title"
    >
      <h2 id="count-comparison-title">Compare saved versions</h2>
      <p>
        {differences.length
          ? `${differences.length} changed ${differences.length === 1 ? "field" : "fields"}.`
          : "No count or time differences."}{" "}
        Reviewing does not change the current saved sheet.
      </p>
      {differences.length ? (
        <div
          className="count-sheet-comparison-scroll"
          tabIndex={0}
          role="region"
          aria-label="Changed count fields"
        >
          <table>
            <caption>
              Blank means no value was entered; zero is a recorded count.
            </caption>
            <thead>
              <tr>
                <th scope="col">Field</th>
                <th scope="col">Current r{currentRevision}</th>
                <th scope="col">Reviewing r{reviewedRevision}</th>
              </tr>
            </thead>
            <tbody>
              {differences.map((row) => (
                <tr key={row.field}>
                  <th scope="row">{row.field}</th>
                  <td>{row.current ?? "Blank"}</td>
                  <td>{row.reviewed ?? "Blank"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
