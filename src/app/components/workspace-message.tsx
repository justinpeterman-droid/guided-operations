import Link from "next/link";
import { Button } from "@/components/ui/button";

import { WorkspaceBrand } from "@/app/components/workspace-brand";

type WorkspaceMessageLinkAction = Readonly<{
  href: string;
  label: string;
}>;

type WorkspaceMessageButtonAction = Readonly<{
  label: string;
  onClick: () => void;
}>;

export type WorkspaceMessageAction =
  WorkspaceMessageLinkAction | WorkspaceMessageButtonAction;

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
        <div className="go-ui workspace-message-actions">
          {actions.map((action, index) =>
            "href" in action ? (
              <Button
                asChild
                variant={index === 0 ? "default" : "outline"}
                key={action.href}
              >
                <Link href={action.href}>{action.label}</Link>
              </Button>
            ) : (
              <Button
                variant={index === 0 ? "default" : "outline"}
                key={action.label}
                onClick={action.onClick}
                type="button"
              >
                {action.label}
              </Button>
            ),
          )}
        </div>
      </section>
    </main>
  );
}
