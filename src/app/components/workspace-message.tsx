import Link from "next/link";

import { WorkspaceBrand } from "@/app/components/workspace-brand";

export type WorkspaceMessageAction = Readonly<{
  href: string;
  label: string;
}>;

export type WorkspaceMessageProps = Readonly<{
  actions: readonly WorkspaceMessageAction[];
  description: string;
  eyebrow: string;
  title: string;
  titleId?: string;
  variant?: "admin" | "officer";
}>;

export const SIGN_IN_ACTION: WorkspaceMessageAction = {
  href: "/login",
  label: "Go to sign in",
};

export const HOME_ACTION: WorkspaceMessageAction = {
  href: "/home",
  label: "Return home",
};

export const WORKSPACE_ACTION: WorkspaceMessageAction = {
  href: "/home",
  label: "Return to your workspace",
};

export const ADMIN_HOME_ACTION: WorkspaceMessageAction = {
  href: "/admin",
  label: "Return to administrator workspace",
};

/** Shared fallback page with brand mark and one or more recovery actions. */
export function WorkspaceMessage({
  actions,
  description,
  eyebrow,
  title,
  titleId = "workspace-message-title",
  variant = "officer",
}: WorkspaceMessageProps) {
  return (
    <main className="reports-page reports-message-page">
      <header className="workspace-message-header">
        <WorkspaceBrand
          href={variant === "admin" ? "/admin" : "/home"}
          title="Guided Operations"
        />
      </header>
      <section className="reports-empty-state" aria-labelledby={titleId}>
        <p className="eyebrow">{eyebrow}</p>
        <h1 id={titleId}>{title}</h1>
        <p>{description}</p>
        <div className="workspace-message-actions">
          {actions.map((action) => (
            <Link
              className="reports-home-link"
              href={action.href}
              key={action.href}
            >
              {action.label}
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
