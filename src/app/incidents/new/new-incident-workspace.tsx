"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import {
  REPORT_CHECKLIST_APPROVAL_STATUS,
  REPORT_CHECKLIST_CATEGORIES,
  buildReportChecklistReviewedItems,
  getApplicableReportChecklistQuestions,
  getReportChecklistCategory,
  validateReportChecklistAnswers,
  type ReportChecklistAnswer,
  type ReportChecklistQuestion,
} from "@/features/incidents/report-assistant-checklist";
import {
  buildReviewedFieldNoteFacts,
  proposeFactsFromFieldNotes,
  type FieldNoteFactProposal,
} from "@/features/incidents/field-note-fact-review";
import type {
  IncidentStaffRelationship,
  IncidentStaffRelationshipType,
} from "@/features/incidents/incident-staff-relationships";
import { INCIDENT_SCHEMA_VERSION } from "@/features/incidents/schema";

type Step = 1 | 2 | 3 | 4 | 5 | 6;
type SaveState = "idle" | "saving" | "failed" | "saved";
type StaffLoadState = "loading" | "failed" | "loaded";
type StaffSelectionItem = Readonly<{
  staffMemberId: string;
  displayName: string;
  employeeNumberHint: string;
  shiftCode: "A" | "B" | "C" | "D" | "U" | "F" | null;
  isCurrentAccount: boolean;
}>;
type FactProposalReview = FieldNoteFactProposal &
  Readonly<{ decision: "pending" | "confirmed" | "excluded" }>;

const INCIDENT_DATE_SCOPE_KEY = "incident-date-time";
const LOCATION_SCOPE_KEY = "location";
const checklistScopeKey = (questionId: string) =>
  `report-checklist:${questionId}`;

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
  const [officerConfirmed, setOfficerConfirmed] = useState(false);
  const [staffLoadState, setStaffLoadState] =
    useState<StaffLoadState>("loading");
  const [staff, setStaff] = useState<readonly StaffSelectionItem[]>([]);
  const [selectedRelationships, setSelectedRelationships] = useState<
    ReadonlySet<string>
  >(new Set());
  const [factReportingScopes, setFactReportingScopes] = useState<
    Readonly<Record<string, readonly string[]>>
  >({});
  const [reportsReviewed, setReportsReviewed] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [incidentNumber, setIncidentNumber] = useState("");
  const [incidentName, setIncidentName] = useState("");
  const [occurredAt, setOccurredAt] = useState("");
  const [location, setLocation] = useState("");
  const [category, setCategory] = useState("");
  const [categoryConfirmed, setCategoryConfirmed] = useState(false);
  const [notes, setNotes] = useState("");
  const [factProposals, setFactProposals] = useState<
    readonly FactProposalReview[]
  >([]);
  const [unknown, setUnknown] = useState("");
  const [checklistAnswers, setChecklistAnswers] = useState<
    Record<string, ReportChecklistAnswer>
  >({});

  const answerList = useMemo(
    () => Object.values(checklistAnswers),
    [checklistAnswers],
  );
  const currentStaff = staff.find((item) => item.isCurrentAccount);
  const staffRelationships = useMemo<IncidentStaffRelationship[]>(() => {
    if (!currentStaff) return [];
    const relationships: IncidentStaffRelationship[] = [
      {
        staffMemberId: currentStaff.staffMemberId,
        relationship: "preparer",
      },
    ];
    for (const key of selectedRelationships) {
      const [staffMemberId, relationship] = key.split(":");
      if (
        staffMemberId &&
        (relationship === "reporting_officer" ||
          relationship === "involved_officer" ||
          relationship === "witness")
      ) {
        relationships.push({ staffMemberId, relationship });
      }
    }
    return relationships;
  }, [currentStaff, selectedRelationships]);
  const reportingOfficerCount = staffRelationships.filter(
    ({ relationship }) => relationship === "reporting_officer",
  ).length;
  const reportingStaff = staff.filter((item) =>
    selectedRelationships.has(`${item.staffMemberId}:reporting_officer`),
  );
  const categoryDefinition = getReportChecklistCategory(category);
  const applicableQuestions = getApplicableReportChecklistQuestions(
    category,
    answerList,
  );
  const checklistReview = validateReportChecklistAnswers(category, answerList);
  const readyForFactReview = Boolean(
    incidentNumber.trim() &&
    incidentName.trim() &&
    occurredAt &&
    location.trim() &&
    categoryDefinition &&
    notes.trim(),
  );
  const confirmedFactProposals = factProposals.filter(
    (proposal) =>
      proposal.decision === "confirmed" && proposal.value.trim().length > 0,
  );
  const factReviewComplete =
    factProposals.length > 0 &&
    factProposals.length <= 200 &&
    factProposals.every(
      (proposal) =>
        proposal.decision !== "pending" &&
        (proposal.decision !== "confirmed" || proposal.value.trim()),
    ) &&
    (confirmedFactProposals.length > 0 || Boolean(unknown.trim()));
  const confirmedFactScopeItems = [
    { key: INCIDENT_DATE_SCOPE_KEY, label: "Incident date and time" },
    { key: LOCATION_SCOPE_KEY, label: "Location" },
    ...confirmedFactProposals.map((proposal, index) => ({
      key: proposal.key,
      label: `Officer-confirmed fact ${index + 1}`,
    })),
    ...answerList.flatMap((answer) => {
      if (answer.state !== "answered") return [];
      const question = applicableQuestions.find(
        (candidate) => candidate.id === answer.questionId,
      );
      return question
        ? [{ key: checklistScopeKey(answer.questionId), label: question.field }]
        : [];
    }),
  ];
  const reportingScopeFor = (key: string): readonly string[] =>
    factReportingScopes[key] ??
    (reportingStaff.length === 1 ? [reportingStaff[0].staffMemberId] : []);
  const factReportingScopesComplete = confirmedFactScopeItems.every(
    ({ key }) => reportingScopeFor(key).length > 0,
  );

  useEffect(() => {
    let active = true;
    void fetch("/api/web/v1/staff?limit=100", {
      credentials: "same-origin",
    })
      .then(async (response) => {
        const body: unknown = await response.json();
        if (
          !response.ok ||
          !body ||
          typeof body !== "object" ||
          !("data" in body) ||
          !body.data ||
          typeof body.data !== "object" ||
          !("staff" in body.data) ||
          !Array.isArray(body.data.staff)
        ) {
          throw new Error("staff");
        }
        return body.data.staff as StaffSelectionItem[];
      })
      .then((items) => {
        if (!active) return;
        const current = items.filter((item) => item.isCurrentAccount);
        if (current.length !== 1) throw new Error("staff");
        setStaff(items);
        setSelectedRelationships(
          new Set([`${current[0].staffMemberId}:reporting_officer`]),
        );
        setStaffLoadState("loaded");
      })
      .catch(() => {
        if (active) setStaffLoadState("failed");
      });
    return () => {
      active = false;
    };
  }, []);

  function canOpenStep(candidate: Step): boolean {
    if (candidate === 1) return true;
    if (candidate === 2) return officerConfirmed;
    if (candidate === 3)
      return officerConfirmed && readyForFactReview && categoryConfirmed;
    if (candidate === 4) return factReviewComplete;
    if (candidate === 5) return checklistReview.complete;
    return checklistReview.complete && reportsReviewed;
  }

  function beginFactReview() {
    const proposals = proposeFactsFromFieldNotes(notes);
    if (!categoryDefinition || !proposals.length || proposals.length > 200) {
      return;
    }
    setCategoryConfirmed(true);
    setFactProposals(
      proposals.map((proposal) => ({ ...proposal, decision: "pending" })),
    );
    setFactReportingScopes({});
    setReportsReviewed(false);
    setSaveState("idle");
    setStep(3);
  }

  function updateFactProposal(
    key: string,
    update: Readonly<Partial<Pick<FactProposalReview, "value" | "decision">>>,
  ) {
    setFactProposals((current) =>
      current.map((proposal) =>
        proposal.key === key
          ? {
              ...proposal,
              ...update,
              ...(update.value === undefined ? {} : { decision: "pending" }),
            }
          : proposal,
      ),
    );
    setFactReportingScopes({});
    setReportsReviewed(false);
    setSaveState("idle");
  }

  function setChecklistAnswer(answer: ReportChecklistAnswer) {
    setChecklistAnswers((current) => {
      const next = { ...current, [answer.questionId]: answer };
      const applicableIds = new Set(
        getApplicableReportChecklistQuestions(
          category,
          Object.values(next),
        ).map((question) => question.id),
      );
      for (const questionId of Object.keys(next)) {
        if (!applicableIds.has(questionId)) delete next[questionId];
      }
      return next;
    });
    setFactReportingScopes({});
    setReportsReviewed(false);
    setSaveState("idle");
  }

  function clearChecklistAnswer(questionId: string) {
    setChecklistAnswers((current) => {
      const next = { ...current };
      delete next[questionId];
      return next;
    });
    setFactReportingScopes({});
    setReportsReviewed(false);
    setSaveState("idle");
  }

  function toggleStaffRelationship(
    staffMemberId: string,
    relationship: Exclude<IncidentStaffRelationshipType, "preparer">,
  ) {
    const key = `${staffMemberId}:${relationship}`;
    setSelectedRelationships((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setFactReportingScopes({});
    setOfficerConfirmed(false);
    setReportsReviewed(false);
    setSaveState("idle");
  }

  function toggleFactReportingScope(key: string, staffMemberId: string) {
    setFactReportingScopes((current) => {
      const selected = new Set(
        current[key] ??
          (reportingStaff.length === 1
            ? [reportingStaff[0].staffMemberId]
            : []),
      );
      if (selected.has(staffMemberId)) selected.delete(staffMemberId);
      else selected.add(staffMemberId);
      return { ...current, [key]: [...selected] };
    });
    setReportsReviewed(false);
    setSaveState("idle");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !readyForFactReview ||
      !factReviewComplete ||
      !checklistReview.complete ||
      !factReportingScopesComplete
    )
      return;
    setSaveState("saving");
    try {
      const token = await csrfToken();
      const recordedAt = new Date().toISOString();
      const occurredAtIso = new Date(occurredAt).toISOString();
      const noteId = crypto.randomUUID();
      const metadataNoteId = crypto.randomUUID();
      const checklist = buildReportChecklistReviewedItems({
        categoryKey: category,
        answers: answerList,
        recordedAt,
        idFactory: () => crypto.randomUUID(),
        reportingStaffMemberIdsByQuestionId: Object.fromEntries(
          answerList.map((answer) => [
            answer.questionId,
            reportingScopeFor(checklistScopeKey(answer.questionId)),
          ]),
        ),
      });
      const reviewedFieldNotes = buildReviewedFieldNoteFacts({
        reviews: factProposals
          .filter(({ decision }) => decision !== "pending")
          .map(({ key, sourceText, value, decision }) => ({
            key,
            sourceText,
            value,
            decision,
          })),
        sourceNoteId: noteId,
        recordedAt,
        idFactory: () => crypto.randomUUID(),
        reportingStaffMemberIdsByProposalKey: Object.fromEntries(
          confirmedFactProposals.map((proposal) => [
            proposal.key,
            reportingScopeFor(proposal.key),
          ]),
        ),
      });
      const body = {
        staffRelationships,
        revision: {
          schemaVersion: INCIDENT_SCHEMA_VERSION,
          incidentNumber: incidentNumber.trim(),
          incidentName: incidentName.trim(),
          category,
          occurredAt: occurredAtIso,
          fieldNotes: [
            { id: noteId, text: notes.trim(), recordedAt },
            {
              id: metadataNoteId,
              text: `Officer-entered incident metadata\nOccurred at: ${occurredAtIso}\nLocation: ${location.trim()}`,
              recordedAt,
            },
            ...reviewedFieldNotes.reviewNotes,
            ...checklist.fieldNotes,
          ],
          reviewedFacts: [
            {
              id: crypto.randomUUID(),
              field: "Incident date and time",
              state: "confirmed" as const,
              value: occurredAtIso,
              sourceNoteIds: [metadataNoteId],
              reportingStaffMemberIds: reportingScopeFor(
                INCIDENT_DATE_SCOPE_KEY,
              ),
            },
            {
              id: crypto.randomUUID(),
              field: "Location",
              state: "confirmed" as const,
              value: location.trim(),
              sourceNoteIds: [metadataNoteId],
              reportingStaffMemberIds: reportingScopeFor(LOCATION_SCOPE_KEY),
            },
            ...reviewedFieldNotes.reviewedFacts,
            ...(unknown.trim()
              ? [
                  {
                    id: crypto.randomUUID(),
                    field: "Information not yet known",
                    state: "unknown" as const,
                    reason: unknown.trim(),
                  },
                ]
              : []),
            ...checklist.reviewedFacts,
          ],
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
            {([1, 2, 3, 4, 5, 6] as const).map((item) => (
              <li className={item === step ? "is-current" : ""} key={item}>
                <button
                  disabled={!canOpenStep(item)}
                  onClick={() => setStep(item)}
                  type="button"
                >
                  <span>{item}</span>
                  <strong>
                    {item === 1
                      ? "Officers"
                      : item === 2
                        ? "Field notes"
                        : item === 3
                          ? "Review facts"
                          : item === 4
                            ? "Missing information"
                            : item === 5
                              ? "Reports"
                              : "Forms & Export"}
                  </strong>
                </button>
              </li>
            ))}
          </ol>
        </nav>
        <form className="incident-stage" onSubmit={save}>
          <h1>
            {step === 1
              ? "Confirm the reporting officer"
              : step === 2
                ? "What is known"
                : step === 3
                  ? "Confirm what a report may use"
                  : step === 4
                    ? "Resolve required questions"
                    : step === 5
                      ? "Review the report package"
                      : "Review forms and save"}
          </h1>
          <p className="incident-guidance">
            Nothing is submitted automatically. Unknown information stays
            visible instead of being guessed.
          </p>
          {step === 1 ? (
            <>
              <section className="incident-review">
                <h2>Officer relationships</h2>
                {staffLoadState === "loading" ? (
                  <p role="status">Loading the active facility roster…</p>
                ) : null}
                {staffLoadState === "failed" ? (
                  <p role="alert">
                    The active roster could not be loaded. No incident can be
                    saved until it is available.
                  </p>
                ) : null}
                {staffLoadState === "loaded" && currentStaff ? (
                  <>
                    <p>
                      <strong>Preparing officer:</strong>{" "}
                      {currentStaff.displayName}. The server fixes this to the
                      signed-in account; preparation never changes authorship.
                    </p>
                    <p>
                      Select at least one reporting officer. Mark other staff
                      only when the incident identifies them as involved or as a
                      witness.
                    </p>
                    <div className="incident-fields">
                      {staff.map((item) => (
                        <fieldset key={item.staffMemberId}>
                          <legend>
                            {item.displayName} · employee ending{" "}
                            {item.employeeNumberHint}
                            {item.shiftCode ? ` · ${item.shiftCode} shift` : ""}
                          </legend>
                          {(
                            [
                              ["reporting_officer", "Reporting officer"],
                              ["involved_officer", "Involved officer"],
                              ["witness", "Witness"],
                            ] as const
                          ).map(([relationship, label]) => (
                            <label key={relationship}>
                              <input
                                checked={selectedRelationships.has(
                                  `${item.staffMemberId}:${relationship}`,
                                )}
                                onChange={() =>
                                  toggleStaffRelationship(
                                    item.staffMemberId,
                                    relationship,
                                  )
                                }
                                type="checkbox"
                              />
                              {label}
                            </label>
                          ))}
                        </fieldset>
                      ))}
                    </div>
                    <p aria-live="polite">
                      {reportingOfficerCount} reporting officer
                      {reportingOfficerCount === 1 ? "" : "s"} selected.
                    </p>
                  </>
                ) : null}
              </section>
              <button
                className="incident-primary"
                disabled={
                  staffLoadState !== "loaded" ||
                  !currentStaff ||
                  reportingOfficerCount < 1
                }
                onClick={() => {
                  setOfficerConfirmed(true);
                  setStep(2);
                }}
                type="button"
              >
                Confirm officer relationships
              </button>
            </>
          ) : null}
          {step === 2 ? (
            <>
              <div className="incident-fields">
                <label>
                  Incident number
                  <input
                    required
                    value={incidentNumber}
                    onChange={(event) => setIncidentNumber(event.target.value)}
                  />
                </label>
                <label>
                  Incident name
                  <input
                    required
                    value={incidentName}
                    onChange={(event) => setIncidentName(event.target.value)}
                  />
                </label>
                <label>
                  Date and time occurred
                  <input
                    required
                    type="datetime-local"
                    value={occurredAt}
                    onChange={(event) => {
                      setOccurredAt(event.target.value);
                      setFactReportingScopes({});
                      setReportsReviewed(false);
                    }}
                  />
                </label>
                <label>
                  Location
                  <input
                    required
                    value={location}
                    onChange={(event) => {
                      setLocation(event.target.value);
                      setFactReportingScopes({});
                      setReportsReviewed(false);
                    }}
                  />
                </label>
                <label>
                  Incident category
                  <select
                    required
                    value={category}
                    onChange={(event) => {
                      setCategory(event.target.value);
                      setCategoryConfirmed(false);
                      setFactProposals([]);
                      setChecklistAnswers({});
                      setFactReportingScopes({});
                      setReportsReviewed(false);
                    }}
                  >
                    <option value="">Choose a controlled category</option>
                    {REPORT_CHECKLIST_CATEGORIES.map((item) => (
                      <option key={item.key} value={item.key}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="incident-full">
                  Your field notes
                  <textarea
                    required
                    value={notes}
                    onChange={(event) => {
                      setNotes(event.target.value);
                      setCategoryConfirmed(false);
                      setFactProposals([]);
                      setFactReportingScopes({});
                      setReportsReviewed(false);
                    }}
                  />
                </label>
              </div>
              {categoryDefinition ? (
                <section className="incident-review" aria-live="polite">
                  <h2>Proposed category</h2>
                  <p>
                    <strong>{categoryDefinition.label}</strong>. Confirm this
                    category before any note can become an approved fact.
                  </p>
                </section>
              ) : null}
              <p className="incident-guidance">
                This recovered checklist is a Preview candidate. It remains
                blocked from Production until its operational owner approves the
                exact version.
              </p>
              <button
                className="incident-primary"
                disabled={
                  !readyForFactReview ||
                  proposeFactsFromFieldNotes(notes).length > 200
                }
                onClick={beginFactReview}
                type="button"
              >
                Confirm category and review facts
              </button>
              {proposeFactsFromFieldNotes(notes).length > 200 ? (
                <p className="incident-status" role="alert">
                  Field notes have more than 200 non-empty lines. Combine
                  related lines before continuing; nothing has been discarded.
                </p>
              ) : null}
            </>
          ) : null}
          {step === 3 ? (
            <>
              <p className="incident-guidance">
                Each note line is only a proposal. Compare it with the source,
                then confirm it or keep it out of every report.
              </p>
              {factProposals.map((proposal, index) => (
                <section className="incident-fact-proposal" key={proposal.key}>
                  <h2>Proposed fact {index + 1}</h2>
                  <p className="incident-source-label">Source note</p>
                  <blockquote>{proposal.sourceText}</blockquote>
                  <label className="incident-fact">
                    Fact {index + 1} for reports
                    <textarea
                      value={proposal.value}
                      onChange={(event) =>
                        updateFactProposal(proposal.key, {
                          value: event.target.value,
                        })
                      }
                    />
                  </label>
                  <div className="incident-review-actions">
                    <button
                      aria-pressed={proposal.decision === "confirmed"}
                      onClick={() =>
                        updateFactProposal(proposal.key, {
                          decision: "confirmed",
                        })
                      }
                      type="button"
                    >
                      Confirm fact
                    </button>
                    <button
                      aria-pressed={proposal.decision === "excluded"}
                      onClick={() =>
                        updateFactProposal(proposal.key, {
                          decision: "excluded",
                        })
                      }
                      type="button"
                    >
                      Do not use
                    </button>
                  </div>
                </section>
              ))}
              <label className="incident-fact">
                Information not yet known
                <textarea
                  value={unknown}
                  onChange={(event) => setUnknown(event.target.value)}
                  placeholder="Keep missing information visible"
                />
              </label>
              <button
                className="incident-primary"
                disabled={!factReviewComplete}
                onClick={() => setStep(4)}
                type="button"
              >
                Continue to missing information
              </button>
            </>
          ) : null}
          {step === 4 ? (
            <>
              <p className="incident-guidance">
                Answer what is known. Unknown and Not applicable are valid
                explicit answers; blank required items cannot be hidden.
              </p>
              {applicableQuestions.map((question) => (
                <ChecklistQuestion
                  answer={checklistAnswers[question.id]}
                  key={question.id}
                  onAnswer={setChecklistAnswer}
                  onClear={() => clearChecklistAnswer(question.id)}
                  question={question}
                />
              ))}
              <p aria-live="polite" className="incident-status">
                {checklistReview.complete
                  ? "Required missing-information questions are reviewed."
                  : `${checklistReview.issues.length} required or invalid checklist item${checklistReview.issues.length === 1 ? " remains" : "s remain"}.`}
              </p>
              <button
                className="incident-primary"
                disabled={!checklistReview.complete}
                onClick={() => setStep(5)}
                type="button"
              >
                Review report types
              </button>
            </>
          ) : null}
          {step === 5 ? (
            <>
              <section className="incident-review">
                <h2>Review summary</h2>
                <p>
                  <strong>{incidentNumber || "No incident number"}</strong> ·{" "}
                  {incidentName || "No incident name"}
                </p>
                <p>
                  {confirmedFactProposals.length} confirmed note fact
                  {confirmedFactProposals.length === 1 ? "" : "s"}
                  {unknown.trim() ? " plus one explicit unknown" : ""} and{" "}
                  {answerList.length} checklist answer
                  {answerList.length === 1 ? "" : "s"}. Saving creates an
                  immutable first revision.
                </p>
                {unknown.trim() ? (
                  <p>
                    <strong>Still unknown:</strong> {unknown.trim()}
                  </p>
                ) : null}
                {categoryDefinition ? (
                  <>
                    <h2>Candidate report types</h2>
                    <ul>
                      {categoryDefinition.reportTypes.map((reportType) => (
                        <li key={reportType}>
                          {reportType.replaceAll("_", " ")}
                        </li>
                      ))}
                    </ul>
                    <p>
                      Reports are not generated from this list. After the
                      incident is saved, each draft still requires selected
                      confirmed facts and officer review.
                    </p>
                  </>
                ) : null}
                <h2>Facts allowed for each officer report</h2>
                <p>
                  Choose which reporting officer may use each confirmed fact.
                  With more than one reporting officer, nothing is shared until
                  you choose it here.
                </p>
                <div className="incident-fields">
                  {confirmedFactScopeItems.map((item) => (
                    <fieldset key={item.key}>
                      <legend>{item.label}</legend>
                      {reportingStaff.map((officer) => (
                        <label key={officer.staffMemberId}>
                          <input
                            checked={reportingScopeFor(item.key).includes(
                              officer.staffMemberId,
                            )}
                            onChange={() =>
                              toggleFactReportingScope(
                                item.key,
                                officer.staffMemberId,
                              )
                            }
                            type="checkbox"
                          />
                          {officer.displayName}
                        </label>
                      ))}
                    </fieldset>
                  ))}
                </div>
                <p aria-live="polite">
                  {factReportingScopesComplete
                    ? "Every confirmed fact has an officer scope."
                    : "Choose at least one reporting officer for every confirmed fact."}
                </p>
              </section>
              <button
                className="incident-primary"
                disabled={!factReportingScopesComplete}
                onClick={() => {
                  setReportsReviewed(true);
                  setStep(6);
                }}
                type="button"
              >
                Continue to Forms &amp; Export
              </button>
            </>
          ) : null}
          {step === 6 ? (
            <>
              <section className="incident-review">
                <h2>Candidate required paperwork</h2>
                {categoryDefinition ? (
                  <ul>
                    {categoryDefinition.requiredForms.map((formType) => (
                      <li key={formType}>{formType.replaceAll("_", " ")}</li>
                    ))}
                  </ul>
                ) : null}
                <p>
                  This list is guidance from the recovered candidate. Saving
                  does not claim that a form was completed, printed, or filed.
                </p>
              </section>
              <button
                className="incident-primary"
                disabled={
                  saveState === "saving" ||
                  !readyForFactReview ||
                  !factReviewComplete ||
                  !checklistReview.complete ||
                  !factReportingScopesComplete
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
          <h2>Report Assistant rules</h2>
          <p>
            Category questions come from one versioned candidate. Required
            answers cannot disappear, and report generation may use only saved
            confirmed facts.
          </p>
          <ul>
            <li>Checklist status: {REPORT_CHECKLIST_APPROVAL_STATUS}</li>
            <li>
              {unknown.trim()
                ? "Unknown information is recorded."
                : "No manual unknowns recorded yet."}
            </li>
            <li>
              {categoryConfirmed
                ? "The officer confirmed the proposed category."
                : "The proposed category is not confirmed."}
            </li>
            <li>
              {checklistReview.complete
                ? "Required checklist review complete."
                : "Checklist review is not complete."}
            </li>
          </ul>
        </aside>
      </div>
    </main>
  );
}

function ChecklistQuestion({
  answer,
  onAnswer,
  onClear,
  question,
}: Readonly<{
  answer: ReportChecklistAnswer | undefined;
  onAnswer: (answer: ReportChecklistAnswer) => void;
  onClear: () => void;
  question: ReportChecklistQuestion;
}>) {
  const answeredValue = answer?.state === "answered" ? answer.value : "";
  const isOther = answeredValue.startsWith("Other: ");
  return (
    <fieldset className="incident-fact">
      <legend>
        {question.prompt} {question.blocking ? "(Required)" : "(If available)"}
      </legend>
      {question.answerType === "text" ? (
        <textarea
          aria-label={`${question.prompt} answer`}
          value={answeredValue}
          onChange={(event) =>
            onAnswer({
              questionId: question.id,
              state: "answered",
              value: event.target.value,
            })
          }
        />
      ) : null}
      {question.answerType === "choice" ? (
        <>
          <select
            aria-label={`${question.prompt} answer`}
            value={isOther ? "__other__" : answeredValue}
            onChange={(event) =>
              onAnswer({
                questionId: question.id,
                state: "answered",
                value:
                  event.target.value === "__other__"
                    ? "Other: "
                    : event.target.value,
              })
            }
          >
            <option value="">Choose an answer</option>
            {question.options?.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
            <option value="__other__">Other (type your own)</option>
          </select>
          {isOther ? (
            <input
              aria-label={`${question.prompt} other answer`}
              value={answeredValue.slice("Other: ".length)}
              onChange={(event) =>
                onAnswer({
                  questionId: question.id,
                  state: "answered",
                  value: `Other: ${event.target.value}`,
                })
              }
            />
          ) : null}
        </>
      ) : null}
      {question.answerType === "yes_no" ? (
        <div>
          {(["Yes", "No"] as const).map((value) => (
            <button
              aria-pressed={answeredValue === value}
              key={value}
              onClick={() =>
                onAnswer({
                  questionId: question.id,
                  state: "answered",
                  value,
                })
              }
              type="button"
            >
              {value}
            </button>
          ))}
        </div>
      ) : null}
      <div>
        <button
          aria-pressed={answer?.state === "unknown"}
          onClick={() =>
            onAnswer({ questionId: question.id, state: "unknown" })
          }
          type="button"
        >
          Unknown
        </button>
        <button
          aria-pressed={answer?.state === "not_applicable"}
          onClick={() =>
            onAnswer({ questionId: question.id, state: "not_applicable" })
          }
          type="button"
        >
          Not applicable
        </button>
        {answer ? (
          <button onClick={onClear} type="button">
            Clear
          </button>
        ) : null}
      </div>
    </fieldset>
  );
}
