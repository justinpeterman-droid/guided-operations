import type { ReactNode } from "react";

import { WorkspaceBrand } from "@/app/components/workspace-brand";
import {
  WorkspaceNavigation,
  type WorkspaceNavigationProps,
} from "@/app/components/workspace-navigation";
import { ImprovementLauncher } from "@/app/components/improvement-launcher";

export type WorkspaceShellProps = Readonly<{
  actions?: ReactNode;
  brandHref?: string;
  children: ReactNode;
  className?: string;
  current?: WorkspaceNavigationProps["current"];
  title: string;
}>;

/** Shared authenticated officer header: brand, navigation, and optional actions. */
export function WorkspaceShell({
  actions,
  brandHref,
  children,
  className = "reports-page",
  current,
  title,
}: WorkspaceShellProps) {
  return (
    <main className={className}>
      <header className="workspace-header workspace-shell-header">
        <WorkspaceBrand href={brandHref} title={title} />
        <div className="workspace-shell-toolbar">
          <WorkspaceNavigation current={current} />
          {actions ? (
            <div className="workspace-shell-actions">{actions}</div>
          ) : null}
          <ImprovementLauncher />
        </div>
      </header>
      {children}
    </main>
  );
}
