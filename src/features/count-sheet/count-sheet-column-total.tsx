"use client";

/** Local attention marker only; never modifies the count payload. */
export function CountSheetColumnTotal({
  column,
  total,
  flagged,
  onToggle,
}: Readonly<{
  column: string;
  total: number;
  flagged: boolean;
  onToggle: () => void;
}>) {
  return (
    <td className={flagged ? "count-sheet-column-flagged" : undefined}>
      <button
        type="button"
        className="count-sheet-column-flag"
        aria-label={`Column ${column} total ${total}. ${flagged ? "Clear red highlight" : "Highlight red"}`}
        aria-pressed={flagged}
        title={
          flagged
            ? `Clear red highlight on column ${column}`
            : `Highlight column ${column} red`
        }
        onClick={onToggle}
      >
        <span className="count-sheet-column-total-value">{total}</span>
        <span className="count-sheet-column-marker" aria-hidden="true">
          {flagged ? "✓" : "!"}
        </span>
      </button>
    </td>
  );
}
