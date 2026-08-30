import Link from "next/link";

import { DailyPaperworkPackageManager } from "@/features/daily-paperwork/daily-paperwork-package-manager";
import type { DailyPaperworkTemplatePackageSummary } from "@/server/paperwork/list-daily-paperwork-template-packages";

const fictionalPackage: DailyPaperworkTemplatePackageSummary = {
  packageId: "77777777-7777-4777-8777-777777777777",
  packageDigest: "a".repeat(64),
  mappingVersion: "daily-paperwork-source-to-form-v1",
  sourceAuthority: "Fictional training records owner",
  sourceRevision: "FICTIONAL-REVISION-01",
  activeFrom: "2026-09-01",
  rollbackOfPackageDigest: null,
  sourceCount: 6,
  totalSourceBytes: 4096,
  approvedAt: "2026-08-28T18:00:00+00:00",
};

/** Fictional visual contract only; every package-import control is inert. */
export default function AdminPaperworkPackagesPreviewPage() {
  return (
    <main className="reports-page">
      <header className="workspace-header reports-header">
        <Link className="workspace-brand" href="/preview/admin">
          <span className="brand-mark" aria-hidden="true">
            GO
          </span>
          <span>
            <span className="eyebrow">Guided Operations</span>
            <strong>Daily Paperwork sources</strong>
          </span>
        </Link>
        <span className="preview-status">Fictional training preview</span>
      </header>

      <section
        className="reports-intro"
        aria-labelledby="preview-package-title"
      >
        <p className="eyebrow">Administrator workspace</p>
        <h1 id="preview-package-title">Approved form packages</h1>
        <p>
          Visual review only. This page uses fictional evidence, cannot read
          source files, and cannot register or change a form package.
        </p>
      </section>

      <DailyPaperworkPackageManager packages={[fictionalPackage]} preview />

      <Link className="workspace-return-link" href="/preview/admin">
        ← Return to administrator preview
      </Link>
    </main>
  );
}
