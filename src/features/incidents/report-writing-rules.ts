export const REPORT_WRITING_RULE_PROFILE = "bmu-house-style-v1";

export const REPORT_WRITING_INSTRUCTIONS = [
  "Apply the BMU house-style profile to the review draft.",
  "Write ADC numbers as 'ADC# 123456' with one space after the hash.",
  "Keep periods in rank abbreviations: Sgt., Cpl., Lt., and Cpt.",
  "Write narrative times as '9:50 pm': 12-hour time, one space, lowercase am or pm.",
  "Keep dates exactly as supplied in the confirmed facts.",
  "Use lowercase 'inmate' before a name in the middle of a sentence.",
  "Use objective chronological language and do not add a statement closer such as 'End of report.'",
  "Do not add clinical injury, diagnosis, evaluator, or treatment detail.",
  "A supervisor summary stays in third person outside verbatim quotations.",
  "A disciplinary report includes the 'Due to the above stated facts' charging sentence and 'pending DCR' only when supported by confirmed charge facts.",
  "Never output bracketed placeholders. Missing information remains outside the generated prose for officer review.",
].join(" ");

export type ReportWritingRuleId =
  | "RW-002"
  | "RW-003"
  | "RW-005"
  | "RW-006"
  | "RW-013"
  | "RW-014"
  | "RW-030"
  | "RW-031"
  | "RW-033"
  | "RW-035";

type DraftForRuleValidation = Readonly<{
  paragraphs: readonly Readonly<{
    text: string;
    sourceFactIds: readonly string[];
  }>[];
}>;

type SourceForRuleValidation = Readonly<{
  reportType: string;
  confirmedFacts: readonly Readonly<{
    id: string;
    value: string;
  }>[];
}>;

const rankWithoutPeriod = /\b(?:Sgt|Cpl|Lt|Cpt)\s+[A-Z]/u;
const timeToken = /\b\d{1,2}:\d{2}(?:\s*[ap]\.?m\.?)?\b/giu;
const approvedTime = /^(?:1[0-2]|0?[1-9]):[0-5]\d (?:am|pm)$/u;
const militaryTime = /\b\d{3,4}\s*hours?\b/iu;
const placeholderName =
  /\b(?:inmate|Sgt\.?|Cpl\.?|Lt\.?|Cpt\.?)\s+(?:None|Unknown)\b/iu;
const forbiddenPlaceholder =
  /\[(?:incident number|name|date|time|location|not in notes|needed:|to be supplemented:)[^\]]*\]/iu;
const medicalTerms = [
  "laceration",
  "fracture",
  "contusion",
  "abrasion",
  "hematoma",
  "diagnosed",
  "treated by",
  "prescribed",
  "stitches",
  "sutures",
  "concussion",
  "hemorrhage",
  "internal injury",
  "spinal",
] as const;
const statementClosers = [
  "end of report.",
  "end of statement.",
  "disciplinary action taken.",
] as const;
const operationalToken =
  /\b\d+(?:[.:/-]\d+)*(?:\s?(?:a\.?m\.?|p\.?m\.?|hours?))?\b/giu;

/**
 * Returns the first blocking legacy house-style rule violated by a generated
 * candidate. Content is never included in the result, so callers can reject a
 * provider response without placing operational text in logs or errors.
 */
export function findBlockingReportWritingRule(
  draft: DraftForRuleValidation,
  source: SourceForRuleValidation,
): ReportWritingRuleId | null {
  const reportType = source.reportType
    .trim()
    .toLocaleLowerCase("en-US")
    .replaceAll(/[^a-z0-9]+/gu, "_")
    .replaceAll(/^_+|_+$/gu, "");

  for (const paragraph of draft.paragraphs) {
    const text = paragraph.text;
    const lower = text.toLocaleLowerCase("en-US");

    if (/\bADC#\d/u.test(text)) return "RW-002";
    if (rankWithoutPeriod.test(text)) return "RW-003";
    if (
      militaryTime.test(text) ||
      [...text.matchAll(timeToken)].some(
        (match) => !approvedTime.test(match[0]),
      )
    )
      return "RW-005";
    if (placeholderName.test(text)) return "RW-006";
    if (statementClosers.some((closer) => lower.includes(closer)))
      return "RW-014";
    if (medicalTerms.some((term) => lower.includes(term))) return "RW-031";
    if (forbiddenPlaceholder.test(text)) return "RW-033";

    if (reportType === "supervisor_summary") {
      const outsideQuotes = text.replaceAll(/"[^"]*"|“[^”]*”/gu, "");
      if (/\b(?:I|me|my)\b/u.test(outsideQuotes)) return "RW-035";
    }

    const citedFacts = source.confirmedFacts.filter((fact) =>
      paragraph.sourceFactIds.includes(fact.id),
    );
    const allowedTokens = new Set(
      citedFacts.flatMap((fact) => extractOperationalTokens(fact.value)),
    );
    if (
      extractOperationalTokens(text).some((token) => !allowedTokens.has(token))
    )
      return "RW-030";
  }

  if (reportType === "disciplinary") {
    const narrative = draft.paragraphs
      .map((paragraph) => paragraph.text)
      .join("\n")
      .toLocaleLowerCase("en-US");
    if (
      !narrative.includes("due to the above stated facts") ||
      !narrative.includes("pending dcr")
    )
      return "RW-013";
  }

  return null;
}

function extractOperationalTokens(value: string): string[] {
  return [...value.matchAll(operationalToken)].map((match) =>
    match[0].toLocaleLowerCase("en-US").replaceAll(/[\s.]+/gu, ""),
  );
}
