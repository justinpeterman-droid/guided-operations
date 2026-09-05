import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

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
      current="Home"
      brandHref="/"
      headerClassName="workspace-preview-header command-center-page-header"
      title="Officer workspace"
    >
      <WorkspaceCommandCenter />

      <section
        className="go-ui mb-8 flex flex-col gap-5 border-t border-border py-6 md:flex-row md:items-center md:justify-between"
        aria-labelledby="admin-title"
      >
        <div className="flex max-w-2xl flex-col gap-2">
          <h2 id="admin-title" className="text-base font-semibold">
            Same workspace. Extra responsibility.
          </h2>
          <p className="text-sm text-muted-foreground">
            Administrators have the same officer tools, plus a protected roster
            to invite, enable, disable, reset, and assign account roles. Those
            actions require a fresh security check and leave a redacted audit
            record.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/preview/admin">
            View administrator layout{" "}
            <ArrowRight aria-hidden="true" data-icon="inline-end" />
          </Link>
        </Button>
      </section>
    </PreviewShell>
  );
}
