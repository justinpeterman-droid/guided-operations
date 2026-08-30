import { WorkspaceBrand } from "@/app/components/workspace-brand";

/** Minimal loading shell shown while server routes resolve authorized data. */
export function WorkspaceLoading({
  title = "Loading workspace…",
}: Readonly<{ title?: string }>) {
  return (
    <main
      aria-busy="true"
      aria-live="polite"
      className="reports-page workspace-loading-page"
    >
      <header className="workspace-message-header">
        <WorkspaceBrand title="Guided Operations" />
      </header>
      <p className="workspace-loading-status" role="status">
        {title}
      </p>
    </main>
  );
}
