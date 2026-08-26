"use client";

import { useState } from "react";

/** Opens the browser print dialog only when the parent marks the sheet ready. */
export function PrintCountSheetButton({
  disabled = false,
  label = "Print training preview",
  onBeforePrint,
}: Readonly<{
  disabled?: boolean;
  label?: string;
  onBeforePrint?: () => Promise<boolean>;
}>) {
  const [preparing, setPreparing] = useState(false);

  async function print() {
    if (preparing || disabled) return;
    if (onBeforePrint) {
      setPreparing(true);
      try {
        if (!(await onBeforePrint())) return;
      } finally {
        setPreparing(false);
      }
    }
    window.print();
  }

  return (
    <button
      className="count-sheet-print-button"
      disabled={disabled || preparing}
      onClick={() => void print()}
      type="button"
    >
      {preparing ? "Preparing print…" : label}
    </button>
  );
}
