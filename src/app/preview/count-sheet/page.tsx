import Link from "next/link";

import { PreviewShell } from "@/app/components/preview-shell";
import { APPROVED_COUNT_SHEET_STRUCTURE } from "@/features/count-sheet/approved-structure";
import { CountSheetPreview } from "@/features/count-sheet/count-sheet-preview";

export default function CountSheetPreviewPage() {
  return (
    <PreviewShell
      actions={
        <Link className="preview-nav-link" href="/preview/report-assistant">
          Report assistant preview
        </Link>
      }
      brandHref="/"
      className="workspace-page"
      headerClassName="workspace-header"
      title="Count Sheet"
    >
      <CountSheetPreview structure={APPROVED_COUNT_SHEET_STRUCTURE} />
    </PreviewShell>
  );
}
