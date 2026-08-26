"use client";

/** Opens the browser print dialog for the explicitly fictional training view. */
export function PrintCountSheetButton() {
  return (
    <button
      className="count-sheet-print-button"
      onClick={() => window.print()}
      type="button"
    >
      Print training preview
    </button>
  );
}
