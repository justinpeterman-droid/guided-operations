"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUnsavedChanges } from "./use-unsaved-changes";

async function csrfToken(): Promise<string> {
  const response = await fetch("/api/auth/csrf", {
    credentials: "same-origin",
    cache: "no-store",
  });
  if (response.status === 401) throw new Error("session_expired");
  const body: unknown = await response.json();
  if (
    !response.ok ||
    !body ||
    typeof body !== "object" ||
    !("csrfToken" in body) ||
    typeof body.csrfToken !== "string"
  ) {
    throw new Error("csrf_unavailable");
  }
  return body.csrfToken;
}

/** Submitters and administrators can continue an in-app follow-up without email content. */
export function ImprovementMessageComposer({
  requestId,
}: Readonly<{ requestId: string }>) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  useUnsavedChanges(Boolean(body));

  async function submit() {
    if (pending || body.trim().length < 1) return;
    setPending(true);
    setError(null);
    setSessionExpired(false);
    try {
      const response = await fetch(
        `/api/web/v1/improvement-requests/${requestId}/messages`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": await csrfToken(),
          },
          body: JSON.stringify({ body: body.trim() }),
        },
      );
      if (response.status === 401) throw new Error("session_expired");
      if (!response.ok) throw new Error("message_failed");
      setBody("");
      router.refresh();
    } catch (error) {
      const expired =
        error instanceof Error && error.message === "session_expired";
      setSessionExpired(expired);
      setError(
        expired
          ? "Your session ended. Your reply is still here. Sign in in a separate tab, then return and retry."
          : "Sending could not be confirmed. Your reply is still here. Check the conversation in a separate tab before sending it again.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <section
      className="improvement-message-composer"
      aria-label="Reply to review"
    >
      <h2>Reply to review</h2>
      <p>
        Use this space to answer a reviewer’s question. Do not include completed
        paperwork or personal information.
      </p>
      <label htmlFor="improvement-message">Your reply</label>
      <textarea
        disabled={pending}
        id="improvement-message"
        maxLength={3000}
        onChange={(event) => setBody(event.target.value)}
        rows={4}
        value={body}
      />
      {error ? (
        <p className="improvement-error" role="alert">
          {error}
        </p>
      ) : null}
      {sessionExpired ? (
        <a href="/login" target="_blank" rel="noopener noreferrer">
          Sign in again (opens a new tab)
        </a>
      ) : null}
      <button
        disabled={pending || body.trim().length < 1}
        onClick={() => void submit()}
        type="button"
      >
        {pending ? "Sending…" : "Send reply"}
      </button>
    </section>
  );
}
