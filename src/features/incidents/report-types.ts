import { z } from "zod";

export const REPORT_TYPES = [
  "first_person",
  "supervisor_summary",
  "cover_letter",
  "disciplinary",
] as const;

export const reportTypeSchema = z.enum(REPORT_TYPES);

export type ReportType = z.infer<typeof reportTypeSchema>;

export type ReportPerspective = "first_person" | "third_person";

export const REPORT_TYPE_DEFINITIONS = {
  first_person: {
    label: "First-person report",
    perspective: "first_person",
  },
  supervisor_summary: {
    label: "Supervisor summary",
    perspective: "third_person",
  },
  cover_letter: {
    label: "Cover letter",
    perspective: "third_person",
  },
  disciplinary: {
    label: "Disciplinary report",
    perspective: "third_person",
  },
} as const satisfies Record<
  ReportType,
  Readonly<{ label: string; perspective: ReportPerspective }>
>;

export function getReportTypeDefinition(reportType: ReportType) {
  return REPORT_TYPE_DEFINITIONS[reportType];
}
