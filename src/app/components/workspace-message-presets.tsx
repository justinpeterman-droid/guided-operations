import {
  ADMIN_HOME_ACTION,
  HOME_ACTION,
  SIGN_IN_ACTION,
  WORKSPACE_ACTION,
  WorkspaceMessage,
  type WorkspaceMessageAction,
} from "@/app/components/workspace-message";

export function AdminAccessRequiredMessage({
  description,
}: Readonly<{ description: string }>) {
  return (
    <WorkspaceMessage
      actions={[WORKSPACE_ACTION]}
      description={description}
      eyebrow="Private workspace"
      title="Administrator access is required."
      variant="admin"
    />
  );
}

export function AdminUnavailableMessage({
  description,
  eyebrow,
  title,
}: Readonly<{ description: string; eyebrow: string; title: string }>) {
  return (
    <WorkspaceMessage
      actions={[ADMIN_HOME_ACTION]}
      description={description}
      eyebrow={eyebrow}
      title={title}
      variant="admin"
    />
  );
}

export function OfficerSignInRequiredMessage({
  description,
  title,
}: Readonly<{ description: string; title: string }>) {
  return (
    <WorkspaceMessage
      actions={[SIGN_IN_ACTION]}
      description={description}
      eyebrow="Private workspace"
      title={title}
    />
  );
}

export function OfficerUnavailableMessage({
  actions = [HOME_ACTION],
  description,
  eyebrow,
  title,
}: Readonly<{
  actions?: readonly WorkspaceMessageAction[];
  description: string;
  eyebrow: string;
  title: string;
}>) {
  return (
    <WorkspaceMessage
      actions={actions}
      description={description}
      eyebrow={eyebrow}
      title={title}
    />
  );
}
