import Link from "next/link";

import { PreviewShell } from "@/app/components/preview-shell";
import { WorkspaceCommandCenter } from "@/app/components/workspace-command-center";

export const metadata = {
  title: "Officer workspace preview",
};

/**
 * A non-persistent visual workspace for owner review. It deliberately never
 * creates data or grants access; real officer pages remain session protected.
 */
export default function WorkspacePreviewPage() {
  return (
    <PreviewShell
      brandHref="/"
      headerClassName="workspace-preview-header command-center-page-header"
      title="Officer workspace"
    >
      <WorkspaceCommandCenter />

      <section
        className="workspace-preview-admin"
        aria-labelledby="admin-title"
      >
        <div>
          <p className="eyebrow">Administrator access</p>
          <h2 id="admin-title">Same workspace. Extra responsibility.</h2>
          <p>
            Administrators have the same officer tools, plus a protected roster
            to invite, enable, disable, reset, and assign account roles. Those
            actions require a fresh security check and leave a redacted audit
            record.
          </p>
        </div>
        <Link className="workspace-admin-link" href="/preview/admin">
          View administrator layout <span aria-hidden="true">→</span>
        </Link>
      </section>
    </PreviewShell>
  );
}
