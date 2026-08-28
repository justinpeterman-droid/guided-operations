"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import type {
  GroundedPolicyAnswer,
  PolicyCollection,
} from "@/features/policy/grounding";
import { WorkspaceNavigation } from "@/app/components/workspace-navigation";

type SubmissionState = "idle" | "submitting" | "failed";
type CollectionScope = "all" | PolicyCollection;

type AnswerOutcome =
  | { kind: "answer" | "insufficient_evidence"; answer: GroundedPolicyAnswer }
  | undefined;

type ConversationEntry = Readonly<{
  question: string;
  outcome: Exclude<AnswerOutcome, undefined>;
}>;

async function getCsrfToken(): Promise<string> {
  const response = await fetch("/api/auth/csrf", {
    cache: "no-store",
    credentials: "same-origin",
  });
  if (!response.ok) throw new Error("CSRF token unavailable");
  const data: unknown = await response.json();
  if (
    !data ||
    typeof data !== "object" ||
    !("csrfToken" in data) ||
    typeof data.csrfToken !== "string"
  ) {
    throw new Error("Malformed CSRF response");
  }
  return data.csrfToken;
}

export function PolicyExpert() {
  const [question, setQuestion] = useState("");
  const [collectionScope, setCollectionScope] =
    useState<CollectionScope>("all");
  const [state, setState] = useState<SubmissionState>("idle");
  const [conversation, setConversation] = useState<ConversationEntry[]>([]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("submitting");
    try {
      const csrfToken = await getCsrfToken();
      const response = await fetch("/api/web/v1/policy-answer", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify({
          question,
          history: conversation.slice(-6).map((entry) => ({
            question: entry.question,
          })),
          ...(collectionScope === "all"
            ? {}
            : { collections: [collectionScope] }),
        }),
      });
      const data: unknown = await response.json();
      if (
        response.ok &&
        data &&
        typeof data === "object" &&
        "data" in data &&
        data.data &&
        typeof data.data === "object" &&
        "outcome" in data.data
      ) {
        const candidate = data.data.outcome;
        if (
          candidate &&
          typeof candidate === "object" &&
          "kind" in candidate &&
          (candidate.kind === "answer" ||
            candidate.kind === "insufficient_evidence") &&
          "answer" in candidate
        ) {
          setConversation((current) =>
            [
              ...current,
              {
                question,
                outcome: candidate as Exclude<AnswerOutcome, undefined>,
              },
            ].slice(-6),
          );
          setQuestion("");
          setState("idle");
          return;
        }
      }
    } catch {
      // Safe generic failure; never render provider or restricted-content details.
    }
    setState("failed");
  }

  const submitting = state === "submitting";

  return (
    <main className="policy-page">
      <header className="workspace-header policy-header">
        <Link className="workspace-brand" href="/">
          <span className="brand-mark" aria-hidden="true">
            GO
          </span>
          <span>
            <span className="eyebrow">Guided Operations</span>
            <strong>Policy Expert</strong>
          </span>
        </Link>
        <WorkspaceNavigation current="Policy" />
      </header>

      <div className="policy-layout">
        <section className="policy-main" aria-labelledby="policy-title">
          <div className="policy-intro">
            <h1 id="policy-title">Policy Expert</h1>
            <p>
              Ask a focused question. Answers are limited to approved policy
              sources and show their citations.
            </p>
          </div>

          <form className="policy-question-form" onSubmit={submit}>
            <label htmlFor="policy-collection">Search collection</label>
            <select
              disabled={submitting}
              id="policy-collection"
              onChange={(event) =>
                setCollectionScope(event.target.value as CollectionScope)
              }
              value={collectionScope}
            >
              <option value="all">All approved policies</option>
              <option value="BMU policies">BMU policies</option>
              <option value="BMU Post Orders">BMU Post Orders</option>
              <option value="SD">SD</option>
            </select>
            <label htmlFor="policy-question">Policy question</label>
            <textarea
              disabled={submitting}
              id="policy-question"
              maxLength={2000}
              minLength={3}
              name="question"
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Ask about an approved policy or procedure"
              required
              value={question}
            />
            <button disabled={submitting} type="submit">
              {submitting ? "Finding cited guidance…" : "Find cited guidance"}
            </button>
            <p aria-live="polite" className="policy-form-status">
              {state === "failed"
                ? "Guidance could not be loaded. Your question was not saved."
                : null}
            </p>
          </form>

          {conversation.length ? (
            <section aria-label="Policy conversation">
              {conversation.map((entry, index) => (
                <article key={`${index}-${entry.question}`}>
                  <p>
                    <strong>Question:</strong> {entry.question}
                  </p>
                  <PolicyAnswer
                    headingId={`policy-answer-title-${index}`}
                    outcome={entry.outcome}
                  />
                </article>
              ))}
            </section>
          ) : null}
        </section>

        <aside className="policy-rail" aria-label="Policy Expert guidance">
          <div aria-hidden="true" className="policy-rail-icon">
            §
          </div>
          <h2>No citation means no authoritative answer.</h2>
          <p>
            Use cited source material to verify guidance before acting. When
            evidence is missing or conflicting, check the source or ask a
            supervisor.
          </p>
        </aside>
      </div>
    </main>
  );
}

function PolicyAnswer({
  headingId,
  outcome,
}: {
  headingId: string;
  outcome: Exclude<AnswerOutcome, undefined>;
}) {
  const heading =
    outcome.kind === "answer" ? "Cited guidance" : "Evidence is not sufficient";
  return (
    <section className="policy-answer" aria-labelledby={headingId}>
      <h2 id={headingId}>{heading}</h2>
      <p className="policy-answer-copy">{outcome.answer.answer}</p>
      {outcome.answer.limitations.length ? (
        <p className="policy-limitation">
          {outcome.answer.limitations.join(" ")}
        </p>
      ) : null}
      {outcome.answer.citations.length ? (
        <ol className="policy-citations">
          {outcome.answer.citations.map((citation) => (
            <li key={citation.chunkId}>
              <strong>{citation.title}</strong>
              <span>{citation.collection}</span>
              <span>{citation.versionLabel}</span>
              <span>
                {citation.pageStart
                  ? citation.pageEnd && citation.pageEnd !== citation.pageStart
                    ? `Pages ${citation.pageStart}–${citation.pageEnd}`
                    : `Page ${citation.pageStart}`
                  : citation.sectionPath}
              </span>
              <Link
                aria-label={`Open ${citation.title} source PDF in a new tab`}
                className="policy-source-link"
                href={`/api/web/v1/policy-sources/${citation.documentVersionId}`}
                rel="noopener noreferrer"
                target="_blank"
              >
                Open source PDF
              </Link>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
