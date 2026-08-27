import { z } from "zod";

import type { ReportType } from "./report-types";

export const REPORT_CHECKLIST_DEFINITION_KEY = "bmu-legacy-candidate";
export const REPORT_CHECKLIST_DEFINITION_VERSION = 1;
export const REPORT_CHECKLIST_SOURCE_COMMIT =
  "ebe52c4b977ab742975974732beec42fff1bbce5";
export const REPORT_CHECKLIST_APPROVAL_STATUS = "candidate" as const;
export const REPORT_CHECKLIST_CANDIDATE_FIELD_PREFIX = `[report-checklist:${REPORT_CHECKLIST_DEFINITION_KEY}@${REPORT_CHECKLIST_DEFINITION_VERSION}:`;

const questionIdSchema = z.string().regex(/^[a-z][a-z0-9_]{1,63}$/);
const nonEmptyText = (maximum: number) => z.string().trim().min(1).max(maximum);

export const reportChecklistAnswerSchema = z.discriminatedUnion("state", [
  z
    .object({
      questionId: questionIdSchema,
      state: z.literal("answered"),
      value: nonEmptyText(8_000),
    })
    .strict(),
  z
    .object({
      questionId: questionIdSchema,
      state: z.literal("unknown"),
    })
    .strict(),
  z
    .object({
      questionId: questionIdSchema,
      state: z.literal("not_applicable"),
    })
    .strict(),
]);

export type ReportChecklistAnswer = z.infer<typeof reportChecklistAnswerSchema>;

export type ReportChecklistQuestion = Readonly<{
  id: string;
  field: string;
  prompt: string;
  answerType: "text" | "yes_no" | "choice";
  blocking: boolean;
  options?: readonly string[];
  dependsOn?: Readonly<{ questionId: string; equals: string }>;
}>;

export type ReportChecklistCategory = Readonly<{
  key: string;
  label: string;
  requiredSlots: readonly string[];
  requiredForms: readonly string[];
  reportTypes: readonly ReportType[];
  questions: readonly ReportChecklistQuestion[];
}>;

const medicalDispositionOptions = [
  "Seen by Infirmary staff",
  "Refused medical",
  "Sent by ambulance to outside facility",
  "N/A - no injuries reported",
] as const;

const escortDestinationOptions = [
  "Restrictive Housing",
  "Infirmary, then Restrictive Housing",
  "Infirmary",
  "Returned to assigned barracks",
] as const;

const authorizationOptions = [
  "Shift Lieutenant",
  "Shift Captain",
  "Chief of Security",
  "Duty Warden",
  "Warden / Deputy Warden",
] as const;

const universalQuestions: readonly ReportChecklistQuestion[] = [
  {
    id: "medical_disposition",
    field: "Medical disposition",
    prompt: "What was the medical disposition for the inmate or inmates?",
    answerType: "choice",
    options: medicalDispositionOptions,
    blocking: true,
  },
  {
    id: "drug_test_disposition",
    field: "Drug-test disposition",
    prompt: "What was the inmate drug-test disposition?",
    answerType: "choice",
    options: ["Conducted", "Refused", "N/A"],
    blocking: false,
  },
  {
    id: "investigation_occurred",
    field: "Investigation occurred",
    prompt: "Did an investigation occur?",
    answerType: "yes_no",
    blocking: true,
  },
  {
    id: "investigation_start_time",
    field: "Investigation start time",
    prompt: "What time did the investigation start?",
    answerType: "text",
    blocking: true,
    dependsOn: { questionId: "investigation_occurred", equals: "Yes" },
  },
  {
    id: "investigation_end_time",
    field: "Investigation end time",
    prompt: "What time did the investigation conclude?",
    answerType: "text",
    blocking: true,
    dependsOn: { questionId: "investigation_occurred", equals: "Yes" },
  },
  {
    id: "investigation_disposition",
    field: "Investigation disposition",
    prompt: "What did the investigation result in?",
    answerType: "text",
    blocking: false,
    dependsOn: { questionId: "investigation_occurred", equals: "Yes" },
  },
];

const photoQuestion: ReportChecklistQuestion = {
  id: "photo_video_obtained",
  field: "Photo or video obtained",
  prompt: "Was photograph or video footage obtained?",
  answerType: "yes_no",
  blocking: false,
};

export const REPORT_CHECKLIST_CATEGORIES = [
  {
    key: "contraband",
    label: "Introduction of Contraband",
    requiredSlots: [
      "date",
      "time",
      "location",
      "inmates_involved",
      "contraband_description",
      "discovery_method",
      "charges",
    ],
    requiredForms: [
      "cover_letter",
      "005_409",
      "major_disciplinary_form",
      "photo_video",
      "chain_of_custody",
      "confiscation_f401",
      "field_test_result",
      "medical_report",
      "inmate_drug_test",
      "money_receipt_business_office",
    ],
    reportTypes: [
      "cover_letter",
      "first_person",
      "supervisor_summary",
      "disciplinary",
    ],
    questions: [
      {
        id: "contraband_suspected_drugs",
        field: "Suspected drugs",
        prompt: "Did the contraband include suspected drugs?",
        answerType: "yes_no",
        blocking: true,
      },
      {
        id: "field_test_result_summary",
        field: "Field-test result",
        prompt: "What was the field-test result?",
        answerType: "choice",
        options: ["Positive", "Negative", "Not yet tested"],
        blocking: true,
        dependsOn: {
          questionId: "contraband_suspected_drugs",
          equals: "Yes",
        },
      },
      {
        id: "contraband_includes_money",
        field: "Money included",
        prompt: "Did the contraband include money?",
        answerType: "yes_no",
        blocking: true,
      },
      {
        id: "money_receipt_number",
        field: "Business Office receipt number",
        prompt: "What was the Business Office receipt number?",
        answerType: "text",
        blocking: true,
        dependsOn: {
          questionId: "contraband_includes_money",
          equals: "Yes",
        },
      },
      {
        id: "chain_of_custody_officer",
        field: "Chain-of-custody officer",
        prompt: "Who took chain of custody of the contraband?",
        answerType: "text",
        blocking: true,
      },
      {
        id: "confiscation_form_completed",
        field: "F401 completed",
        prompt: "Was the F401 Confiscation Form completed?",
        answerType: "yes_no",
        blocking: false,
      },
      photoQuestion,
    ],
  },
  {
    key: "inmate_fight",
    label: "Inmate on Inmate Fight/Assault",
    requiredSlots: [
      "date",
      "time",
      "location",
      "inmates_involved",
      "inmate_injuries",
      "restraints_applied_by",
      "escorted_by",
      "escort_destination",
      "charges",
    ],
    requiredForms: [
      "cover_letter",
      "005_409",
      "major_disciplinary_form",
      "photo_video",
      "weapon_chain_of_custody_f401",
      "witness_statements",
      "enemy_alert_form",
      "medical_report",
      "inmate_drug_test",
      "24_hour_review",
      "72_hour_review",
      "emergency_gate_pass_if_treated_outside",
    ],
    reportTypes: [
      "cover_letter",
      "first_person",
      "supervisor_summary",
      "disciplinary",
    ],
    questions: [
      {
        id: "restraints_applied_by",
        field: "Restraints applied by",
        prompt: "Who placed hand restraints on the inmate or inmates?",
        answerType: "text",
        blocking: true,
      },
      {
        id: "escorted_by",
        field: "Escorted by",
        prompt: "Who escorted the inmate or inmates?",
        answerType: "text",
        blocking: true,
      },
      {
        id: "escort_destination",
        field: "Escort destination",
        prompt: "Where were the inmates escorted?",
        answerType: "choice",
        options: escortDestinationOptions,
        blocking: true,
      },
      {
        id: "witness_statements_collected",
        field: "Witness statements collected",
        prompt: "Were witness statements collected?",
        answerType: "yes_no",
        blocking: false,
      },
      {
        id: "enemy_alert_filed",
        field: "Enemy Alert filed",
        prompt: "Was an Enemy Alert Form filed?",
        answerType: "yes_no",
        blocking: false,
      },
      {
        id: "weapon_involved",
        field: "Weapon involved",
        prompt: "Was a weapon involved?",
        answerType: "yes_no",
        blocking: true,
      },
      {
        id: "weapon_custody_officer",
        field: "Weapon custody officer",
        prompt: "Who took chain of custody of the weapon?",
        answerType: "text",
        blocking: true,
        dependsOn: { questionId: "weapon_involved", equals: "Yes" },
      },
      {
        id: "emergency_gate_pass",
        field: "Emergency Gate Pass",
        prompt: "Was an Emergency Gate Pass issued?",
        answerType: "yes_no",
        blocking: false,
        dependsOn: {
          questionId: "medical_disposition",
          equals: "Sent by ambulance to outside facility",
        },
      },
      photoQuestion,
    ],
  },
  {
    key: "staff_assault",
    label: "Staff Assault/Battery",
    requiredSlots: [
      "date",
      "time",
      "location",
      "inmates_involved",
      "employees_involved",
      "officer_injuries",
      "restraints_applied_by",
      "escorted_by",
      "escort_destination",
      "charges",
    ],
    requiredForms: [
      "cover_letter",
      "005_409",
      "major_disciplinary_form",
      "photo_video",
      "injured_staff_company_nurse",
      "officer_accident_report",
      "weapon_chain_of_custody_f401",
      "medical_report",
      "inmate_drug_test",
      "24_hour_review",
      "72_hour_review",
    ],
    reportTypes: [
      "cover_letter",
      "first_person",
      "supervisor_summary",
      "disciplinary",
    ],
    questions: [
      {
        id: "staff_injured",
        field: "Staff injured",
        prompt: "Was a staff member injured?",
        answerType: "yes_no",
        blocking: true,
      },
      {
        id: "company_nurse_confirmation_number",
        field: "Company Nurse confirmation number",
        prompt: "What was the Company Nurse confirmation number?",
        answerType: "text",
        blocking: true,
        dependsOn: { questionId: "staff_injured", equals: "Yes" },
      },
      {
        id: "officer_accident_report_completed",
        field: "Officer Accident Report completed",
        prompt: "Was the Officer Accident Report completed?",
        answerType: "yes_no",
        blocking: false,
        dependsOn: { questionId: "staff_injured", equals: "Yes" },
      },
      {
        id: "restraints_applied_by",
        field: "Restraints applied by",
        prompt: "Who placed hand restraints on the inmate?",
        answerType: "text",
        blocking: true,
      },
      {
        id: "escorted_by",
        field: "Escorted by",
        prompt: "Who escorted the inmate?",
        answerType: "text",
        blocking: true,
      },
      {
        id: "escort_destination",
        field: "Escort destination",
        prompt: "Where was the inmate escorted?",
        answerType: "choice",
        options: escortDestinationOptions,
        blocking: true,
      },
      {
        id: "weapon_involved",
        field: "Weapon involved",
        prompt: "Was a weapon involved?",
        answerType: "yes_no",
        blocking: true,
      },
      {
        id: "weapon_custody_officer",
        field: "Weapon custody officer",
        prompt: "Who took chain of custody of the weapon?",
        answerType: "text",
        blocking: true,
        dependsOn: { questionId: "weapon_involved", equals: "Yes" },
      },
      photoQuestion,
    ],
  },
  {
    key: "forced_cell_movement",
    label: "Forced Cell Movement",
    requiredSlots: [
      "date",
      "time",
      "location",
      "inmates_involved",
      "authorization",
      "orders_given",
      "video_recorded",
      "charges",
    ],
    requiredForms: [
      "cover_letter",
      "005_409",
      "major_disciplinary_form",
      "forced_cell_movement_fact_sheet",
      "photo_video",
      "chain_of_custody",
      "medical_report",
      "inmate_drug_test",
      "24_hour_review",
      "72_hour_review",
      "emergency_gate_pass_if_treated_outside",
    ],
    reportTypes: [
      "cover_letter",
      "first_person",
      "supervisor_summary",
      "disciplinary",
    ],
    questions: [
      {
        id: "authorization",
        field: "Forced-movement authorization",
        prompt: "Who authorized the forced cell movement?",
        answerType: "choice",
        options: authorizationOptions,
        blocking: true,
      },
      {
        id: "orders_given",
        field: "Orders given before force",
        prompt: "What direct orders were given, and how many times?",
        answerType: "text",
        blocking: true,
      },
      {
        id: "video_recorded",
        field: "Movement video",
        prompt: "Was the movement recorded on video, and by whom?",
        answerType: "text",
        blocking: true,
      },
      {
        id: "emergency_gate_pass",
        field: "Emergency Gate Pass",
        prompt: "Was an Emergency Gate Pass issued?",
        answerType: "yes_no",
        blocking: false,
        dependsOn: {
          questionId: "medical_disposition",
          equals: "Sent by ambulance to outside facility",
        },
      },
      photoQuestion,
    ],
  },
  {
    key: "prea",
    label: "PREA",
    requiredSlots: [
      "date",
      "time",
      "location",
      "inmates_involved",
      "allegation_summary",
      "prea_notification_made",
      "charges",
    ],
    requiredForms: [
      "cover_letter",
      "005_409",
      "prea_checklist",
      "prea_notification",
      "photo_video",
      "medical_report",
      "inmate_drug_test",
      "emergency_gate_pass_if_treated_outside",
    ],
    reportTypes: [
      "cover_letter",
      "first_person",
      "supervisor_summary",
      "disciplinary",
    ],
    questions: [
      {
        id: "prea_checklist_completed",
        field: "PREA checklist completed",
        prompt: "Was the PREA checklist completed?",
        answerType: "yes_no",
        blocking: false,
      },
      {
        id: "prea_notification_made",
        field: "PREA notification",
        prompt: "To whom was the PREA notification made?",
        answerType: "text",
        blocking: true,
      },
      photoQuestion,
    ],
  },
  {
    key: "incident_no_disciplinary",
    label: "Incident (No Disciplinary)",
    requiredSlots: ["date", "time", "location", "description"],
    requiredForms: ["cover_letter", "005_409", "photo_video", "medical_report"],
    reportTypes: ["cover_letter", "first_person", "supervisor_summary"],
    questions: [photoQuestion],
  },
  {
    key: "use_of_force",
    label: "Use of Force",
    requiredSlots: [
      "date",
      "time",
      "location",
      "inmates_involved",
      "force_type",
      "orders_given",
      "authorization",
      "decontamination",
      "charges",
    ],
    requiredForms: [
      "cover_letter",
      "005_409",
      "major_disciplinary_form",
      "photo_video",
      "chain_of_custody",
      "use_of_force_report_409",
      "medical_report",
      "inmate_drug_test",
      "emergency_gate_pass_if_treated_outside",
    ],
    reportTypes: [
      "cover_letter",
      "first_person",
      "supervisor_summary",
      "disciplinary",
    ],
    questions: [
      {
        id: "force_type",
        field: "Force type",
        prompt: "What type of force was used?",
        answerType: "choice",
        options: [
          "Chemical agent (OC/MK-3)",
          "Taser displayed, not deployed",
          "Taser deployed",
          "Physical or empty-hand control",
          "Forced restraint application",
          "Baton",
        ],
        blocking: true,
      },
      {
        id: "orders_given",
        field: "Orders given before force",
        prompt: "What direct orders were given, and how many times?",
        answerType: "text",
        blocking: true,
      },
      {
        id: "chemical_agent",
        field: "Chemical-agent details",
        prompt: "What were the chemical-agent type and identifying details?",
        answerType: "text",
        blocking: true,
        dependsOn: {
          questionId: "force_type",
          equals: "Chemical agent (OC/MK-3)",
        },
      },
      {
        id: "decontamination",
        field: "Decontamination",
        prompt: "Was decontamination offered, and where?",
        answerType: "text",
        blocking: true,
        dependsOn: {
          questionId: "force_type",
          equals: "Chemical agent (OC/MK-3)",
        },
      },
      {
        id: "authorization",
        field: "Use-of-force authorization",
        prompt: "Who authorized or was notified of the use of force?",
        answerType: "choice",
        options: authorizationOptions,
        blocking: true,
      },
      {
        id: "behavior_control",
        field: "Behavior control status",
        prompt:
          "Was behavior-control status authorized, by whom, and for how long?",
        answerType: "text",
        blocking: false,
      },
      photoQuestion,
    ],
  },
  {
    key: "medical_emergency",
    label: "Medical Emergency",
    requiredSlots: [
      "date",
      "time",
      "location",
      "inmates_involved",
      "medical_condition",
      "medical_response",
    ],
    requiredForms: [
      "cover_letter",
      "005_409",
      "photo_video",
      "witness_statements",
      "medical_report",
      "inmate_drug_test",
      "emergency_gate_pass_if_treated_outside",
    ],
    reportTypes: ["cover_letter", "first_person", "supervisor_summary"],
    questions: [
      {
        id: "medical_condition",
        field: "Observed medical condition",
        prompt: "What was observed?",
        answerType: "text",
        blocking: true,
      },
      {
        id: "medical_response",
        field: "Staff medical response",
        prompt: "What did staff do before medical personnel arrived?",
        answerType: "text",
        blocking: true,
      },
      {
        id: "observation_ordered",
        field: "Medical observation order",
        prompt: "Did medical order an observation period, and for how long?",
        answerType: "text",
        blocking: false,
      },
      {
        id: "escort_destination",
        field: "Post-evaluation destination",
        prompt: "Where was the inmate escorted after evaluation?",
        answerType: "choice",
        options: [
          "Infirmary",
          "Infirmary ward for observation",
          "Returned to barracks",
          "Sent by ambulance to outside facility",
        ],
        blocking: false,
      },
      photoQuestion,
    ],
  },
  {
    key: "other_rule_violation",
    label: "Other Rule Violation",
    requiredSlots: [
      "date",
      "time",
      "location",
      "inmates_involved",
      "violation_description",
      "charges",
    ],
    requiredForms: [
      "cover_letter",
      "005_409",
      "major_disciplinary_form",
      "photo_video",
      "medical_report",
      "inmate_drug_test",
    ],
    reportTypes: [
      "cover_letter",
      "first_person",
      "supervisor_summary",
      "disciplinary",
    ],
    questions: [photoQuestion],
  },
] as const satisfies readonly ReportChecklistCategory[];

export type ReportChecklistCategoryKey =
  (typeof REPORT_CHECKLIST_CATEGORIES)[number]["key"];

export type ReportChecklistIssue = Readonly<{
  questionId: string;
  code:
    | "duplicate_answer"
    | "inactive_answer"
    | "invalid_answer"
    | "missing_blocking_answer"
    | "unknown_question";
}>;

export function getReportChecklistCategory(
  categoryKey: string,
): ReportChecklistCategory | undefined {
  return REPORT_CHECKLIST_CATEGORIES.find(
    (category) => category.key === categoryKey,
  );
}

export function getApplicableReportChecklistQuestions(
  categoryKey: string,
  answers: readonly ReportChecklistAnswer[],
): readonly ReportChecklistQuestion[] {
  const category = getReportChecklistCategory(categoryKey);
  if (!category) return [];

  const answerByQuestion = new Map(
    answers.map((answer) => [answer.questionId, answer]),
  );
  return [...universalQuestions, ...category.questions].filter((question) => {
    if (!question.dependsOn) return true;
    const controllingAnswer = answerByQuestion.get(
      question.dependsOn.questionId,
    );
    return (
      controllingAnswer?.state === "answered" &&
      controllingAnswer.value === question.dependsOn.equals
    );
  });
}

export function validateReportChecklistAnswers(
  categoryKey: string,
  answerCandidates: readonly unknown[],
): Readonly<{
  answers: readonly ReportChecklistAnswer[];
  issues: readonly ReportChecklistIssue[];
  complete: boolean;
}> {
  const category = getReportChecklistCategory(categoryKey);
  if (!category) {
    return {
      answers: [],
      issues: [{ questionId: "category", code: "unknown_question" }],
      complete: false,
    };
  }

  const answers: ReportChecklistAnswer[] = [];
  const issues: ReportChecklistIssue[] = [];
  const seen = new Set<string>();
  for (const candidate of answerCandidates) {
    const parsed = reportChecklistAnswerSchema.safeParse(candidate);
    if (!parsed.success) {
      issues.push({ questionId: "invalid", code: "invalid_answer" });
      continue;
    }
    if (seen.has(parsed.data.questionId)) {
      issues.push({
        questionId: parsed.data.questionId,
        code: "duplicate_answer",
      });
      continue;
    }
    seen.add(parsed.data.questionId);
    answers.push(parsed.data);
  }

  const allQuestions = [...universalQuestions, ...category.questions];
  const allQuestionIds = new Set(allQuestions.map((question) => question.id));
  for (const answer of answers) {
    if (!allQuestionIds.has(answer.questionId)) {
      issues.push({
        questionId: answer.questionId,
        code: "unknown_question",
      });
    }
  }

  const applicableQuestions = getApplicableReportChecklistQuestions(
    categoryKey,
    answers,
  );
  const applicableIds = new Set(
    applicableQuestions.map((question) => question.id),
  );
  const answerByQuestion = new Map(
    answers.map((answer) => [answer.questionId, answer]),
  );
  for (const answer of answers) {
    if (
      allQuestionIds.has(answer.questionId) &&
      !applicableIds.has(answer.questionId)
    ) {
      issues.push({
        questionId: answer.questionId,
        code: "inactive_answer",
      });
    }
  }

  for (const question of applicableQuestions) {
    const answer = answerByQuestion.get(question.id);
    if (!answer) {
      if (question.blocking) {
        issues.push({
          questionId: question.id,
          code: "missing_blocking_answer",
        });
      }
      continue;
    }
    if (answer.state !== "answered") continue;
    if (
      (question.answerType === "yes_no" &&
        answer.value !== "Yes" &&
        answer.value !== "No") ||
      (question.answerType === "choice" &&
        !question.options?.includes(answer.value) &&
        !answer.value.startsWith("Other: "))
    ) {
      issues.push({ questionId: question.id, code: "invalid_answer" });
    }
  }

  return { answers, issues, complete: issues.length === 0 };
}

export function checklistFieldForQuestion(
  question: ReportChecklistQuestion,
): string {
  return `${REPORT_CHECKLIST_CANDIDATE_FIELD_PREFIX}${question.id}] ${question.field}`;
}

export function revisionUsesCandidateReportChecklist(
  reviewedFacts: readonly Readonly<{ field: string }>[],
): boolean {
  return reviewedFacts.some((fact) =>
    fact.field.startsWith(REPORT_CHECKLIST_CANDIDATE_FIELD_PREFIX),
  );
}

export function buildReportChecklistReviewedItems(
  input: Readonly<{
    categoryKey: string;
    answers: readonly unknown[];
    recordedAt: string;
    idFactory: () => string;
  }>,
): Readonly<{
  fieldNotes: readonly Readonly<{
    id: string;
    text: string;
    recordedAt: string;
  }>[];
  reviewedFacts: readonly (
    | Readonly<{
        id: string;
        field: string;
        state: "confirmed";
        value: string;
        sourceNoteIds: readonly string[];
      }>
    | Readonly<{
        id: string;
        field: string;
        state: "unknown" | "not_applicable";
        reason: string;
      }>
  )[];
}> {
  const review = validateReportChecklistAnswers(
    input.categoryKey,
    input.answers,
  );
  if (!review.complete) {
    throw new Error("Report checklist review is incomplete.");
  }

  const questions = new Map(
    getApplicableReportChecklistQuestions(
      input.categoryKey,
      review.answers,
    ).map((question) => [question.id, question]),
  );
  const fieldNotes: Array<{ id: string; text: string; recordedAt: string }> =
    [];
  const reviewedFacts: Array<
    | {
        id: string;
        field: string;
        state: "confirmed";
        value: string;
        sourceNoteIds: string[];
      }
    | {
        id: string;
        field: string;
        state: "unknown" | "not_applicable";
        reason: string;
      }
  > = [];

  for (const answer of review.answers) {
    const question = questions.get(answer.questionId);
    if (!question) continue;
    const field = checklistFieldForQuestion(question);
    if (answer.state === "answered") {
      const noteId = input.idFactory();
      fieldNotes.push({
        id: noteId,
        text: `Checklist response — ${question.prompt}\n${answer.value}`,
        recordedAt: input.recordedAt,
      });
      reviewedFacts.push({
        id: input.idFactory(),
        field,
        state: "confirmed",
        value: answer.value,
        sourceNoteIds: [noteId],
      });
    } else {
      reviewedFacts.push({
        id: input.idFactory(),
        field,
        state: answer.state,
        reason:
          answer.state === "unknown"
            ? "Officer marked this checklist item Unknown."
            : "Officer marked this checklist item Not applicable.",
      });
    }
  }

  return { fieldNotes, reviewedFacts };
}
