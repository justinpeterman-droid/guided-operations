"use client";

export function PrintReportButton() {
  return (
    <button
      className="reports-home-link report-print-button"
      onClick={() => window.print()}
      type="button"
    >
      Print current report
    </button>
  );
}
