"use client";

import Link from "next/link";

import { WorkspaceBrand } from "@/app/components/workspace-brand";

/** Root error boundary for unexpected render failures. */
export default function RootError({
  reset,
}: Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>) {
  return (
    <main className="reports-page reports-message-page">
      <header className="workspace-message-header">
        <WorkspaceBrand title="Guided Operations" />
      </header>
      <section
        className="reports-empty-state"
        aria-labelledby="root-error-title"
      >
        <p className="eyebrow">Workspace unavailable</p>
        <h1 id="root-error-title">This page cannot load right now.</h1>
        <p>
          Your work has not been changed. You can return home or try loading
          this page again.
        </p>
        <div className="workspace-message-actions">
          <Link className="reports-home-link" href="/home">
            Return home
          </Link>
          <button
            className="reports-home-link workspace-retry-button"
            onClick={reset}
            type="button"
          >
            Try again
          </button>
        </div>
      </section>
    </main>
  );
}
