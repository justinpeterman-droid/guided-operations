"use client";

type CountSheetAreaLabelProps = Readonly<{
  area: string;
  flagged: boolean;
  onToggle: () => void;
}>;

/**
 * Sticky area name plus a session-only attention mark. The mark does not change
 * counts, save payload, or print as an official field — it only highlights the
 * row while the officer is working the sheet.
 */
export function CountSheetAreaLabel({
  area,
  flagged,
  onToggle,
}: CountSheetAreaLabelProps) {
  return (
    <th scope="row">
      <div className="count-sheet-area-label">
        <span>{area}</span>
        <button
          aria-label={
            flagged
              ? `Clear attention mark on ${area}`
              : `Mark ${area} as needing attention`
          }
          aria-pressed={flagged}
          className={
            flagged
              ? "count-sheet-area-flag is-active"
              : "count-sheet-area-flag"
          }
          onClick={onToggle}
          type="button"
        >
          !
        </button>
      </div>
    </th>
  );
}
