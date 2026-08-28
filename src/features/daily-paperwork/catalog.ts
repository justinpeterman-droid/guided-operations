import { z } from "zod";

export const DAILY_PAPERWORK_KINDS = [
  "assignment_roster",
  "uniform_inspection",
  "metal_detector_test",
  "perimeter_check",
  "random_search_log",
  "detector_sign_out",
] as const;

export const dailyPaperworkKindSchema = z.enum(DAILY_PAPERWORK_KINDS);
export type DailyPaperworkKind = z.infer<typeof dailyPaperworkKindSchema>;

export const SHIFT_OPTIONS = [
  { code: "A", label: "A · Day shift" },
  { code: "B", label: "B · Day shift" },
  { code: "C", label: "C · Night shift" },
  { code: "D", label: "D · Night shift" },
  { code: "U", label: "U · Five-day week" },
  { code: "F", label: "F · Five-day week field" },
] as const;

export const shiftCodeSchema = z.enum(["A", "B", "C", "D", "U", "F"]);
export type ShiftCode = z.infer<typeof shiftCodeSchema>;

export const dailyPaperworkCatalog = [
  {
    kind: "assignment_roster",
    title: "Shift Assignment Roster",
    purpose:
      "Prepare the reviewed assignment structure for one date and shift.",
  },
  {
    kind: "uniform_inspection",
    title: "Uniform Inspection Log",
    purpose: "Record the reviewed uniform inspection fields and comments.",
  },
  {
    kind: "metal_detector_test",
    title: "Walk-Through Metal Detector Test",
    purpose: "Record detector test results and required corrective action.",
  },
  {
    kind: "perimeter_check",
    title: "Perimeter Check List",
    purpose:
      "Record reviewed perimeter check results in approved source order.",
  },
  {
    kind: "random_search_log",
    title: "Random Searches Log",
    purpose: "Record the approved search-log fields without invented entries.",
  },
  {
    kind: "detector_sign_out",
    title: "Handheld Metal Detector Sign-Out",
    purpose:
      "Record reviewed equipment sign-out fields for the selected shift.",
  },
] as const satisfies ReadonlyArray<{
  kind: DailyPaperworkKind;
  title: string;
  purpose: string;
}>;

export function shiftLabel(code: ShiftCode): string {
  return SHIFT_OPTIONS.find((option) => option.code === code)?.label ?? code;
}
