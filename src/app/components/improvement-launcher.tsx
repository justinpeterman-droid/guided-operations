"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Dialog as DialogPrimitive } from "radix-ui";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUnsavedChanges } from "./use-unsaved-changes";

type SelectedTarget = Readonly<{
  id?: string;
  role?: string;
  label?: string;
}>;

type LauncherState = "closed" | "menu" | "selecting" | "compose" | "sent";

function closestTarget(start: EventTarget | null): HTMLElement | null {
  if (!(start instanceof HTMLElement)) return null;
  return start.closest(
    "[data-feedback-id], button, a, input, select, textarea, [role], h1, h2, h3, section, article, li",
  );
}

function targetSummary(target: HTMLElement): SelectedTarget {
  const label = [
    target.getAttribute("aria-label"),
    target.getAttribute("data-feedback-label"),
    target.textContent?.replace(/\s+/g, " ").trim(),
  ].find((value) => value && value.length > 0);
  return {
    id: target.dataset.feedbackId || undefined,
    role: target.getAttribute("role") || target.tagName.toLowerCase(),
    label: label?.slice(0, 240),
  };
}

async function csrfToken(): Promise<string> {
  const response = await fetch("/api/auth/csrf", {
    credentials: "same-origin",
    cache: "no-store",
  });
  const body: unknown = await response.json();
  if (
    !response.ok ||
    typeof body !== "object" ||
    body === null ||
    !("csrfToken" in body) ||
    typeof body.csrfToken !== "string"
  ) {
    throw new Error("csrf_unavailable");
  }
  return body.csrfToken;
}

/** Shared, authenticated entry point for private page-improvement feedback. */
export function ImprovementLauncher() {
  const [state, setState] = useState<LauncherState>("closed");
  const [selected, setSelected] = useState<SelectedTarget | null>(null);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedElementRef = useRef<HTMLElement | null>(null);
  const requestRef = useRef<{ fingerprint: string; body: string } | null>(null);
  const submittingRef = useRef(false);
  useUnsavedChanges(Boolean(description) && state !== "sent");

  function clearSelectedElement() {
    selectedElementRef.current?.removeAttribute("data-feedback-selected");
    selectedElementRef.current = null;
  }

  useEffect(() => {
    if (state !== "selecting") return;

    function cancel(event: KeyboardEvent) {
      if (event.key === "Escape") {
        clearSelectedElement();
        setState("menu");
      }
    }
    function choose(event: MouseEvent) {
      const target = closestTarget(event.target);
      if (!target || target.closest("[data-feedback-ignore]")) return;
      event.preventDefault();
      event.stopPropagation();
      clearSelectedElement();
      target.setAttribute("data-feedback-selected", "true");
      selectedElementRef.current = target;
      setSelected(targetSummary(target));
      setState("compose");
    }

    document.addEventListener("keydown", cancel);
    document.addEventListener("click", choose, true);
    return () => {
      document.removeEventListener("keydown", cancel);
      document.removeEventListener("click", choose, true);
    };
  }, [state]);

  useEffect(() => clearSelectedElement, []);

  function close() {
    if (submittingRef.current) return;
    if (
      description &&
      state !== "sent" &&
      !window.confirm("Discard your unsent suggestion?")
    )
      return;
    clearSelectedElement();
    setSelected(null);
    setDescription("");
    requestRef.current = null;
    setError(null);
    setState("closed");
  }

  async function submit() {
    if (submittingRef.current) return;
    if (description.trim().length < 3) {
      setError("Describe what should change before sending it.");
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const content = {
        requestKind: "page_feedback",
        category: "idea",
        description,
        routePath: window.location.pathname,
        target: selected ?? undefined,
      };
      const fingerprint = JSON.stringify(content);
      if (requestRef.current?.fingerprint !== fingerprint)
        requestRef.current = {
          fingerprint,
          body: JSON.stringify({
            requestNonce: crypto.randomUUID(),
            ...content,
            viewport: { width: window.innerWidth, height: window.innerHeight },
          }),
        };
      const token = await csrfToken();
      const response = await fetch("/api/web/v1/improvement-requests", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": token,
        },
        body: requestRef.current.body,
      });
      if (!response.ok) throw new Error("request_failed");
      clearSelectedElement();
      setState("sent");
    } catch {
      setError(
        "Sending could not be confirmed. Your suggestion is still here. Retry unchanged to check the same suggestion; editing starts a separate request.",
      );
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  if (state === "selecting") {
    return (
      <div className="improvement-selection-notice" data-feedback-ignore>
        <strong>Tap the exact item you mean.</strong>
        <span>Press Escape to cancel.</span>
        <button onClick={() => setState("menu")} type="button">
          Cancel
        </button>
      </div>
    );
  }

  return (
    <DialogPrimitive.Root
      open={state !== "closed"}
      onOpenChange={(open) => {
        if (open) setState("menu");
        else close();
      }}
    >
      <div className="go-ui">
        <DialogPrimitive.Trigger asChild>
          <Button
            variant="outline"
            data-feedback-id="suggest-change-trigger"
            type="button"
          >
            <MessageSquare aria-hidden="true" />
            Suggest a change
          </Button>
        </DialogPrimitive.Trigger>
      </div>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="improvement-dialog-backdrop"
          data-feedback-ignore
        >
          <DialogPrimitive.Content
            aria-labelledby="improvement-dialog-title"
            aria-describedby={undefined}
            className="improvement-dialog"
            onInteractOutside={(event) => event.preventDefault()}
          >
            <div className="improvement-dialog-heading">
              <div>
                <p className="eyebrow">Help improve Guided Operations</p>
                <DialogPrimitive.Title id="improvement-dialog-title">
                  Suggest a change
                </DialogPrimitive.Title>
              </div>
              <button
                disabled={submitting}
                aria-label="Close suggestion"
                onClick={close}
                type="button"
              >
                Close
              </button>
            </div>

            {state === "menu" ? (
              <div className="improvement-choice-list">
                <button onClick={() => setState("selecting")} type="button">
                  <strong>Point to this page</strong>
                  <span>Tap the exact button, field, heading, or section.</span>
                </button>
                <button
                  onClick={() => {
                    setSelected({ label: "Whole page" });
                    setState("compose");
                  }}
                  type="button"
                >
                  <strong>Report something not working</strong>
                  <span>Tell us what happened and what you expected.</span>
                </button>
                <Link href="/improvements/new?kind=form">
                  <strong>Request or upload a form</strong>
                  <span>Send a blank form candidate for review.</span>
                </Link>
                <Link href="/improvements">
                  <strong>My suggestions and requests</strong>
                  <span>See the status or reply to a follow-up.</span>
                </Link>
              </div>
            ) : null}

            {state === "compose" ? (
              <form
                className="improvement-compose-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void submit();
                }}
              >
                <p className="improvement-target-summary">
                  About: <strong>{selected?.label ?? "This page"}</strong>
                </p>
                <label htmlFor="improvement-description">
                  What should change?
                </label>
                <textarea
                  disabled={submitting}
                  autoFocus
                  id="improvement-description"
                  maxLength={4000}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Explain what was confusing, missing, or not working."
                  required
                  rows={6}
                  value={description}
                />
                <p className="improvement-privacy-note">
                  The site records this page and the selected item. It does not
                  take a screen capture or copy what is on the page.
                </p>
                {error ? (
                  <p className="improvement-error" role="alert">
                    {error}
                  </p>
                ) : null}
                <div className="improvement-dialog-actions">
                  <button
                    disabled={submitting}
                    onClick={() => setState("menu")}
                    type="button"
                  >
                    Back
                  </button>
                  <button disabled={submitting} type="submit">
                    {submitting ? "Sending…" : "Send suggestion"}
                  </button>
                </div>
              </form>
            ) : null}

            {state === "sent" ? (
              <div className="improvement-success">
                <h3>Suggestion sent</h3>
                <p>You can keep working. You will see any follow-up here.</p>
                <div className="improvement-dialog-actions">
                  <button onClick={close} type="button">
                    Done
                  </button>
                  <Link href="/improvements">View my requests</Link>
                </div>
              </div>
            ) : null}
          </DialogPrimitive.Content>
        </DialogPrimitive.Overlay>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
