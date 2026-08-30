import Link from "next/link";
import type { ReactNode } from "react";

import { WorkspaceShell } from "@/app/components/workspace-shell";

export type AdminShellProps = Readonly<{
  actions?: ReactNode;
  brandHref?: string;
  children: ReactNode;
  className?: string;
  title: string;
}>;

/** Shared authenticated administrator header with officer navigation. */
export function AdminShell({
  actions,
  brandHref = "/admin",
  children,
  className = "reports-page",
  title,
}: AdminShellProps) {
  return (
    <WorkspaceShell
      actions={actions ?? <AdminHomeLink />}
      brandHref={brandHref}
      className={className}
      current="Home"
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
