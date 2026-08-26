import Link from "next/link";

import { CountSheetPreview } from "@/features/count-sheet/count-sheet-preview";
import type { CountSheetStructure } from "@/features/count-sheet/types";

const FICTIONAL_COUNT_SHEET: CountSheetStructure = {
  schema_version: 1,
  title: "Fictional training count sheet",
  columns: ["A", "B", "C", "D", "U", "F"],
  areas: ["Administration", "Dining"],
  operational_fields: ["on_site", "court", "hospital", "other"],
  attachment_reminders: ["court", "hospital"],
};

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

      <CountSheetPreview structure={FICTIONAL_COUNT_SHEET} />
    </main>
  );
}
