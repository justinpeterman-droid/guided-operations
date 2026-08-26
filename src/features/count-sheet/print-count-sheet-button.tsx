"use client";

/** Opens the browser print dialog only when the parent marks the sheet ready. */
export function PrintCountSheetButton({
  disabled = false,
  label = "Print training preview",
}: Readonly<{ disabled?: boolean; label?: string }>) {
  return (
    <button
      className="count-sheet-print-button"
      disabled={disabled}
      onClick={() => window.print()}
      type="button"
    >
      {label}
    </button>
  );
}
