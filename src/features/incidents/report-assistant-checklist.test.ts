import { describe, expect, it } from "vitest";

import {
  REPORT_CHECKLIST_APPROVAL_STATUS,
  REPORT_CHECKLIST_CATEGORIES,
  REPORT_CHECKLIST_SOURCE_COMMIT,
  buildReportChecklistReviewedItems,
  checklistFieldForQuestion,
  getApplicableReportChecklistQuestions,
  getReportChecklistCategory,
  revisionUsesCandidateReportChecklist,
  validateReportChecklistAnswers,
  type ReportChecklistAnswer,
} from "./report-assistant-checklist";

describe("versioned Report Assistant checklist", () => {
  it("preserves all nine legacy category families as a non-production candidate", () => {
    expect(REPORT_CHECKLIST_CATEGORIES).toHaveLength(9);
    expect(REPORT_CHECKLIST_CATEGORIES.map((category) => category.key)).toEqual(
      [
        "contraband",
        "inmate_fight",
        "staff_assault",
        "forced_cell_movement",
        "prea",
        "incident_no_disciplinary",
        "use_of_force",
        "medical_emergency",
        "other_rule_violation",
      ],
    );
    expect(REPORT_CHECKLIST_APPROVAL_STATUS).toBe("candidate");
    expect(REPORT_CHECKLIST_SOURCE_COMMIT).toMatch(/^[a-f0-9]{40}$/);
  });

  it("shows dependent questions only after the controlling answer applies", () => {
    expect(
      getApplicableReportChecklistQuestions("contraband", []).map(
        (question) => question.id,
      ),
    ).not.toContain("field_test_result_summary");

    const questions = getApplicableReportChecklistQuestions("contraband", [
      {
        questionId: "contraband_suspected_drugs",
        state: "answered",
        value: "Yes",
      },
    ]);
    expect(questions.map((question) => question.id)).toContain(
      "field_test_result_summary",
    );
  });

  it("requires every applicable blocking answer while allowing explicit Unknown", () => {
    const incomplete = validateReportChecklistAnswers(
      "incident_no_disciplinary",
      [],
    );
    expect(incomplete.complete).toBe(false);
    expect(incomplete.issues).toEqual(
      expect.arrayContaining([
        {
          questionId: "medical_disposition",
          code: "missing_blocking_answer",
        },
        {
          questionId: "investigation_occurred",
          code: "missing_blocking_answer",
        },
      ]),
    );

    const complete = validateReportChecklistAnswers(
      "incident_no_disciplinary",
      [
        { questionId: "medical_disposition", state: "unknown" },
        {
          questionId: "investigation_occurred",
          state: "answered",
          value: "No",
        },
      ],
    );
    expect(complete).toMatchObject({ complete: true, issues: [] });
  });

  it("rejects stale hidden answers and values outside a controlled choice", () => {
    const review = validateReportChecklistAnswers("contraband", [
      {
        questionId: "medical_disposition",
        state: "answered",
        value: "Invented disposition",
      },
      {
        questionId: "investigation_occurred",
        state: "answered",
        value: "No",
      },
      {
        questionId: "investigation_start_time",
        state: "answered",
        value: "fixture time",
      },
    ]);
    expect(review.issues).toEqual(
      expect.arrayContaining([
        { questionId: "medical_disposition", code: "invalid_answer" },
        { questionId: "investigation_start_time", code: "inactive_answer" },
      ]),
    );
  });

  it("turns an officer answer into a note-backed confirmed fact and keeps limits explicit", () => {
    const answers: ReportChecklistAnswer[] = [
      {
        questionId: "medical_disposition",
        state: "answered",
        value: "N/A - no injuries reported",
      },
      {
        questionId: "investigation_occurred",
        state: "answered",
        value: "No",
      },
      { questionId: "photo_video_obtained", state: "unknown" },
    ];
    const ids = [
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
      "33333333-3333-4333-8333-333333333333",
      "44444444-4444-4444-8444-444444444444",
      "55555555-5555-4555-8555-555555555555",
    ];
    const built = buildReportChecklistReviewedItems({
      categoryKey: "incident_no_disciplinary",
      answers,
      recordedAt: "2026-08-27T12:00:00.000Z",
      idFactory: () => ids.shift() ?? "",
    });

    expect(built.fieldNotes).toHaveLength(2);
    expect(built.reviewedFacts).toHaveLength(3);
    expect(built.reviewedFacts[0]).toMatchObject({
      state: "confirmed",
      value: "N/A - no injuries reported",
      sourceNoteIds: ["11111111-1111-4111-8111-111111111111"],
    });
    expect(built.reviewedFacts[2]).toMatchObject({
      state: "unknown",
      reason: "Officer marked this checklist item Unknown.",
    });
    expect(built.reviewedFacts.every((fact) => fact.field.length <= 120)).toBe(
      true,
    );
    expect(revisionUsesCandidateReportChecklist(built.reviewedFacts)).toBe(
      true,
    );
  });

  it("binds every candidate field to a stable definition and question ID", () => {
    for (const category of REPORT_CHECKLIST_CATEGORIES) {
      expect(category.requiredSlots.length).toBeGreaterThan(0);
      expect(category.requiredForms.length).toBeGreaterThan(0);
      expect(category.reportTypes.length).toBeGreaterThan(0);
      for (const question of category.questions) {
        expect(checklistFieldForQuestion(question).length).toBeLessThanOrEqual(
          120,
        );
      }
    }
    expect(getReportChecklistCategory("not-a-category")).toBeUndefined();
  });
});
