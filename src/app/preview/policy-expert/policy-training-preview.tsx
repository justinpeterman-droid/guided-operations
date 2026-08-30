"use client";

import Link from "next/link";
import { useState } from "react";

import { PreviewShell } from "@/app/components/preview-shell";

const trainingQuestions = [
  {
    answer:
      "Keep the facts you know separate from details that still need confirmation. Review the source before you rely on the guidance.",
    label: "What should I check before preparing paperwork?",
  },
  {
    answer:
      "Training guidance stays limited to the example shown here. A working Policy Expert must return approved source passages or say that evidence is unavailable.",
    label: "What happens when the source is missing?",
  },
] as const;

/** Local-only interaction demo. It never sends a question or presents a source as authoritative. */
export function PolicyTrainingPreview() {
  const [selectedQuestion, setSelectedQuestion] = useState(0);
  const selected = trainingQuestions[selectedQuestion];

  return (
    <PreviewShell
      className="policy-training-page"
      headerClassName="workspace-preview-header command-center-page-header"
      title="Policy Expert"
    >
      <section className="policy-training-intro" aria-labelledby="policy-title">
        <h1 id="policy-title">Find the source before you decide.</h1>
        <p>
          Policy Expert is a separate way to begin work. It should show the
          source passage, make limits clear, and leave the final decision with
          you.
        </p>
      </section>

      <section
        className="policy-training-workspace"
        aria-label="Policy training example"
      >
        <div className="policy-training-questions">
          <h2>Choose a training question</h2>
          <p>
            These examples are local to this preview. No question is sent,
            retained, or matched against a real policy source.
          </p>
          <div>
            {trainingQuestions.map((question, index) => (
              <button
                aria-pressed={selectedQuestion === index}
                key={question.label}
                onClick={() => setSelectedQuestion(index)}
                type="button"
              >
                {question.label}
              </button>
            ))}
          </div>
        </div>

        <section
          className="policy-training-answer"
          aria-live="polite"
          aria-labelledby="training-answer-title"
        >
          <p className="eyebrow">Training guidance</p>
          <h2 id="training-answer-title">Source check required</h2>
          <p>{selected.answer}</p>
          <div className="policy-training-citation" role="note">
            <strong>Fictional source example</strong>
            <span>
              No approved policy source is connected to this training preview.
            </span>
          </div>
        </section>
      </section>

      <Link className="policy-training-return" href="/preview/workspace">
        Return to command center
      </Link>
    </PreviewShell>
  );
}
