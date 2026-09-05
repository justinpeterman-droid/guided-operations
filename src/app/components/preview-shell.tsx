"use client";

import type { ReactNode } from "react";

import {
  WorkspaceNavigation,
  type WorkspaceNavigationProps,
} from "@/app/components/workspace-navigation";

import { WorkspaceBrand } from "@/app/components/workspace-brand";

export type PreviewShellProps = Readonly<{
  actions?: ReactNode;
  brandHref?: string;
  children: ReactNode;
  className?: string;
  headerClassName?: string;
  title: string;
  current?: WorkspaceNavigationProps["current"];
}>;

/** Shared fictional preview chrome with GuidedMark branding. */
export function PreviewShell({
  actions,
  brandHref = "/preview/workspace",
  children,
  className = "workspace-preview-page",
  headerClassName = "workspace-preview-header",
  title,
  current,
}: PreviewShellProps) {
  return (
    <main className={className}>
      <header className={headerClassName}>
        <WorkspaceBrand href={brandHref} title={title} />
        <div className="preview-shell-toolbar">
          <span className="preview-status">Fictional training preview</span>
          {actions}
        </div>
      </header>
      <WorkspaceNavigation preview current={current} />
      {children}
    </main>
  );
}
