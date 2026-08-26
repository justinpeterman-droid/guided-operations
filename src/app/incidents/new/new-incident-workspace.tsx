"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

type Step = 1 | 2 | 3;
type SaveState = "idle" | "saving" | "failed" | "saved";

async function csrfToken(): Promise<string> {
  const response = await fetch("/api/auth/csrf", {
    credentials: "same-origin",
  });
  const data: unknown = await response.json();
  if (
    !response.ok ||
    !data ||
    typeof data !== "object" ||
    !("csrfToken" in data) ||
    typeof data.csrfToken !== "string"
  )
    throw new Error("csrf");
  return data.csrfToken;
}

export function NewIncidentWorkspace() {
  const [step, setStep] = useState<Step>(1);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [incidentNumber, setIncidentNumber] = useState("");
  const [incidentName, setIncidentName] = useState("");
  const [category, setCategory] = useState("");
  const [notes, setNotes] = useState("");
  const [fact, setFact] = useState("");
  const [unknown, setUnknown] = useState("");

  const readyForReview =
    incidentNumber.trim() &&
    incidentName.trim() &&
    category.trim() &&
    notes.trim();
  const facts = [
    ...(fact.trim()
      ? [{ state: "confirmed" as const, text: fact.trim() }]
      : []),
    ...(unknown.trim()
      ? [{ state: "unknown" as const, text: unknown.trim() }]
      : []),
  ];

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!readyForReview || !facts.length) return;
    setSaveState("saving");
    try {
      const token = await csrfToken();
      const noteId = crypto.randomUUID();
      const body = {
        revision: {
          schemaVersion: 1,
          incidentNumber: incidentNumber.trim(),
          incidentName: incidentName.trim(),
          category: category.trim(),
          occurredAt: new Date().toISOString(),
          fieldNotes: [
            {
              id: noteId,
              text: notes.trim(),
              recordedAt: new Date().toISOString(),
            },
          ],
          reviewedFacts: facts.map((item) =>
            item.state === "confirmed"
              ? {
                  id: crypto.randomUUID(),
                  field: "Officer-confirmed fact",
                  state: "confirmed",
                  value: item.text,
                  sourceNoteIds: [noteId],
                }
              : {
                  id: crypto.randomUUID(),
                  field: "Information not yet known",
                  state: "unknown",
                  reason: item.text,
                },
          ),
        },
      };
      const response = await fetch("/api/web/v1/incidents", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": token,
          "idempotency-key": crypto.randomUUID().replaceAll("-", ""),
        },
        body: JSON.stringify(body),
      });
      setSaveState(response.ok ? "saved" : "failed");
    } catch {
      setSaveState("failed");
    }
  }

  return (
    <main className="incident-page">
      <header className="workspace-header incident-header">
        <Link className="workspace-brand" href="/">
          <span className="brand-mark" aria-hidden="true">
            GO
          </span>
          <span>
            <span className="eyebrow">Guided Operations</span>
            <strong>New incident</strong>
          </span>
        </Link>
        <Link className="reports-home-link" href="/reports">
          Reports
        </Link>
      </header>
      <div className="incident-workspace">
        <nav className="incident-steps" aria-label="Incident workflow">
          <ol>
            {([1, 2, 3] as const).map((item) => (
              <li className={item === step ? "is-current" : ""} key={item}>
                <button onClick={() => setStep(item)} type="button">
                  <span>{item}</span>
                  <strong>
                    {item === 1
                      ? "Field notes"
                      : item === 2
                        ? "Confirm facts"
                        : "Review draft"}
                  </strong>
                </button>
              </li>
            ))}
          </ol>
        </nav>
        <form className="incident-stage" onSubmit={save}>
          <h1>
            {step === 1
              ? "What is known"
              : step === 2
                ? "Confirm what the draft may use"
                : "Review before saving"}
          </h1>
          <p className="incident-guidance">
            Nothing is submitted automatically. Unknown information stays
            visible instead of being guessed.
          </p>
          {step === 1 ? (
            <>
              <div className="incident-fields">
                <label>
                  Incident number
                  <input
                    required
                    value={incidentNumber}
                    onChange={(e) => setIncidentNumber(e.target.value)}
                  />
                </label>
                <label>
                  Incident name
                  <input
                    required
                    value={incidentName}
                    onChange={(e) => setIncidentName(e.target.value)}
                  />
                </label>
                <label>
                  Category
                  <input
                    required
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  />
                </label>
                <label className="incident-full">
                  Your field notes
                  <textarea
                    required
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </label>
              </div>
              <button
                className="incident-primary"
                disabled={!readyForReview}
                onClick={() => setStep(2)}
                type="button"
              >
                Continue to fact review
              </button>
            </>
          ) : null}
          {step === 2 ? (
            <>
              <label className="incident-fact">
                Confirmed fact
                <textarea
                  value={fact}
                  onChange={(e) => setFact(e.target.value)}
                  placeholder="Only a fact supported by your notes"
                />
              </label>
              <label className="incident-fact">
                Information not yet known
                <textarea
                  value={unknown}
                  onChange={(e) => setUnknown(e.target.value)}
                  placeholder="Keep missing information visible"
                />
              </label>
              <button
                className="incident-primary"
                disabled={!facts.length}
                onClick={() => setStep(3)}
                type="button"
              >
                Review incident
              </button>
            </>
          ) : null}
          {step === 3 ? (
            <>
              <section className="incident-review">
                <h2>Review summary</h2>
                <p>
                  <strong>{incidentNumber || "No incident number"}</strong> ·{" "}
                  {incidentName || "No incident name"}
                </p>
                <p>
                  {facts.length} reviewed item{facts.length === 1 ? "" : "s"}.
                  Saving creates an immutable first revision.
                </p>
              </section>
              <button
                className="incident-primary"
                disabled={
                  saveState === "saving" || !readyForReview || !facts.length
                }
                type="submit"
              >
                {saveState === "saving" ? "Saving incident…" : "Save incident"}
              </button>
              <p aria-live="polite" className="incident-status">
                {saveState === "saved"
                  ? "Incident saved. Return to Reports to view the authorized list."
                  : saveState === "failed"
                    ? "The incident could not be saved. Nothing was changed."
                    : null}
              </p>
            </>
          ) : null}
        </form>
        <aside className="incident-rail">
          <h2>Missing information</h2>
          <p>
            Use the unknown field to keep unconfirmed details visible during
            review.
          </p>
          <ul>
            {facts.some((item) => item.state === "unknown") ? (
              facts
                .filter((item) => item.state === "unknown")
                .map((item) => <li key={item.text}>{item.text}</li>)
            ) : (
              <li>No unknowns recorded yet.</li>
            )}
          </ul>
        </aside>
      </div>
    </main>
  );
}
