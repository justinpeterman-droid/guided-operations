"use client";

import {
  HOME_ACTION,
  WorkspaceMessage,
} from "@/app/components/workspace-message";

/** Root error boundary for unexpected render failures. */
export default function RootError({
  reset,
}: Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>) {
  return (
    <WorkspaceMessage
      actions={[HOME_ACTION, { label: "Try again", onClick: reset }]}
      description="Your work has not been changed. You can return home or try loading this page again."
      eyebrow="Workspace unavailable"
      title="This page cannot load right now."
      titleId="root-error-title"
    />
  );
}
