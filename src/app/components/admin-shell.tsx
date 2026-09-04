import Link from "next/link";
import type { ReactNode } from "react";

import { WorkspaceShell } from "@/app/components/workspace-shell";
import type { WorkspaceNavigationProps } from "@/app/components/workspace-navigation";

export type AdminShellProps = Readonly<{
  actions?: ReactNode;
  brandHref?: string;
  children: ReactNode;
  className?: string;
  /**
   * Officer-nav highlight. Admin routes intentionally leave this unset so no
   * officer destination appears current while the administrator workspace is
   * active; pass a label only when an admin page is also that officer route.
   */
  current?: WorkspaceNavigationProps["current"];
  title: string;
}>;

/** Shared authenticated administrator header with officer navigation. */
export function AdminShell({
  actions,
  brandHref = "/admin",
  children,
  className = "reports-page",
  current,
  title,
}: AdminShellProps) {
  return (
    <WorkspaceShell
      actions={actions ?? <AdminHomeLink />}
      brandHref={brandHref}
      className={`workspace-shell-admin ${className}`.trim()}
      current={current}
      title={title}
    >
      {children}
    </WorkspaceShell>
  );
}

function AdminHomeLink() {
  return (
    <Link className="reports-home-link" href="/admin">
      Administrator home
    </Link>
  );
}

export function AdminAccountLink() {
  return (
    <Link className="reports-home-link" href="/account">
      Account
    </Link>
  );
}
