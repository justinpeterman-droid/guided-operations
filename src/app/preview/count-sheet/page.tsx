import Link from "next/link";

import { APPROVED_COUNT_SHEET_STRUCTURE } from "@/features/count-sheet/approved-structure";
import { CountSheetPreview } from "@/features/count-sheet/count-sheet-preview";

export default function CountSheetPreviewPage() {
  return (
    <main className="workspace-page">
      <header className="workspace-header">
        <Link className="workspace-brand" href="/">
          <span className="brand-mark" aria-hidden="true">
            GO
          </span>
          <span>
            <span className="eyebrow">Guided Operations</span>
            <strong>Count Sheet</strong>
          </span>
        </Link>
        <Link className="preview-status" href="/preview/report-assistant">
          Report assistant preview
        </Link>
      </header>

      <CountSheetPreview structure={APPROVED_COUNT_SHEET_STRUCTURE} />
    </main>
  );
}
