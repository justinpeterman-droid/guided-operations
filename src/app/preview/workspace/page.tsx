import Link from "next/link";

import {
  GuidedMark,
  WorkspaceCommandCenter,
} from "@/app/components/workspace-command-center";

/**
 * A non-persistent visual workspace for owner review. It deliberately never
 * creates data or grants access; real officer pages remain session protected.
 */
export default function WorkspacePreviewPage() {
  return (
    <main className="workspace-preview-page">
      <header className="workspace-preview-header command-center-page-header">
        <Link className="workspace-brand" href="/">
          <GuidedMark />
          <span>
            <span className="eyebrow">Guided Operations</span>
            <strong>Officer workspace</strong>
          </span>
        </Link>
        <span className="preview-status">Fictional training preview</span>
      </header>

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
    </main>
  );
}
