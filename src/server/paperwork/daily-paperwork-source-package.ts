import "server-only";

import { createHash } from "node:crypto";

import { z } from "zod";

import {
  DAILY_PAPERWORK_KINDS,
  type DailyPaperworkKind,
} from "@/features/daily-paperwork/catalog";

const MAX_SOURCE_BYTES = 256_000;
const code = z.string().regex(/^[a-z][a-z0-9_]{0,63}$/);
const boundedText = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .refine((value) => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value))
  .refine((value) => !/<[^>]+>/u.test(value))
  .refine((value) => !/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/iu.test(value))
  .refine((value) => !/\bADC#?\s*\d{4,}\b/iu.test(value));
const textList = z.array(boundedText).min(1).max(256);
const orientation = z.enum(["portrait", "landscape"]);

const common = {
  title: boundedText,
  schema_version: z.literal(1),
  print_orientation: orientation,
};

const assignmentRosterSchema = z
  .object({
    kind: z.literal("assignment_roster"),
    ...common,
    definition: z
      .object({
        facility_label: boundedText,
        zones: z
          .array(
            z
              .object({
                code,
                label: boundedText,
                area: boundedText,
                supervisor_label: boundedText,
                posts: z
                  .array(
                    z
                      .object({
                        code,
                        label: boundedText,
                        priority: z.enum(["P1", "P2"]).optional(),
                      })
                      .strict(),
                  )
                  .min(1)
                  .max(100)
                  .refine(uniqueCodes),
              })
              .strict(),
          )
          .min(1)
          .max(20)
          .refine(uniqueCodes),
        assignment_states: z
          .array(z.enum(["unassigned", "assigned", "no_officer_available"]))
          .length(3)
          .refine(uniqueStrings),
        assignment_columns: textList.length(2),
        operational_fields: textList,
        security_equipment: textList,
        sign_off_fields: textList,
        priority_one_warning: boundedText,
        notes: textList,
        distribution: textList,
      })
      .strict(),
  })
  .strict();

const uniformInspectionSchema = z
  .object({
    kind: z.literal("uniform_inspection"),
    ...common,
    definition: z
      .object({
        facility_label: boundedText,
        header_fields: textList,
        columns: z.array(code).min(1).max(32).refine(uniqueStrings),
        column_labels: textList,
        values: z
          .array(z.enum(["S", "N/I", "U", "NONE"]))
          .length(4)
          .refine(uniqueStrings),
        value_labels: z
          .object({
            S: boundedText,
            "N/I": boundedText,
            U: boundedText,
            NONE: boundedText,
          })
          .strict(),
        comment_required_for: z.array(z.literal("U")).length(1),
        sign_off_fields: textList,
        footer_fields: textList,
      })
      .strict()
      .refine(
        (definition) =>
          definition.columns.length === definition.column_labels.length,
        { message: "Uniform columns and labels must match." },
      ),
  })
  .strict();

const metalDetectorSchema = z
  .object({
    kind: z.literal("metal_detector_test"),
    ...common,
    definition: z
      .object({
        header_fields: textList,
        detectors: z.array(boundedText).min(1).max(100).refine(uniqueStrings),
        positions: textList,
        values: z
          .array(z.enum(["P", "F"]))
          .length(2)
          .refine(uniqueStrings),
        value_labels: z.object({ P: boundedText, F: boundedText }).strict(),
        runtime_detector_fields: z
          .object({
            location: z.literal(""),
            equipment_identifier: z.literal(""),
          })
          .strict(),
        failure_requires_corrective_action: z.literal(true),
        sign_off_fields: textList,
        footer_fields: textList,
      })
      .strict(),
  })
  .strict();

const perimeterSchema = z
  .object({
    kind: z.literal("perimeter_check"),
    ...common,
    definition: z
      .object({
        values: z
          .array(z.enum(["S", "U"]))
          .length(2)
          .refine(uniqueStrings),
        value_labels: z.object({ S: boundedText, U: boundedText }).strict(),
        groups: z
          .array(
            z
              .object({
                code,
                label: boundedText,
                items: z
                  .array(z.object({ code, label: boundedText }).strict())
                  .min(1)
                  .max(200)
                  .refine(uniqueCodes),
              })
              .strict(),
          )
          .min(1)
          .max(20)
          .refine(uniqueCodes),
        sign_off_fields: textList,
      })
      .strict(),
  })
  .strict();

const repeatedFieldSchema = z
  .object({
    sections: textList,
    blocks_per_section: z.number().int().min(1).max(50),
    fields: z.array(code).min(1).max(32).refine(uniqueStrings),
    field_labels: textList,
  })
  .strict()
  .refine(
    (definition) => definition.fields.length === definition.field_labels.length,
    {
      message: "Repeated fields and labels must match.",
    },
  );

const randomSearchSchema = z
  .object({
    kind: z.literal("random_search_log"),
    ...common,
    definition: repeatedFieldSchema,
  })
  .strict();

const detectorSignOutSchema = z
  .object({
    kind: z.literal("detector_sign_out"),
    ...common,
    definition: z
      .object({
        units: textList.refine(uniqueStrings),
        fields: z.array(code).min(1).max(32).refine(uniqueStrings),
        field_labels: textList,
      })
      .strict()
      .refine(
        (definition) =>
          definition.fields.length === definition.field_labels.length,
        { message: "Sign-out fields and labels must match." },
      ),
  })
  .strict();

const sourceDefinitionSchema = z.discriminatedUnion("kind", [
  assignmentRosterSchema,
  uniformInspectionSchema,
  metalDetectorSchema,
  perimeterSchema,
  randomSearchSchema,
  detectorSignOutSchema,
]);

const EXPECTED_FILE_BY_KIND: Readonly<Record<DailyPaperworkKind, string>> = {
  assignment_roster: "assignment_roster.json",
  uniform_inspection: "uniform_inspection.json",
  metal_detector_test: "metal_detector_test.json",
  perimeter_check: "perimeter_check.json",
  random_search_log: "random_search_log.json",
  detector_sign_out: "detector_sign_out.json",
};

export type DailyPaperworkSourceFile = Readonly<{
  filename: string;
  bytes: Uint8Array;
}>;

export type ParsedDailyPaperworkSource = z.infer<typeof sourceDefinitionSchema>;

export type VerifiedDailyPaperworkSource = Readonly<{
  kind: DailyPaperworkKind;
  filename: string;
  byteLength: number;
  sha256: string;
  source: ParsedDailyPaperworkSource;
}>;

/**
 * Validates the complete six-file package in memory. Callers must not log or
 * persist source bodies outside the isolated Production template registry.
 */
export function verifyDailyPaperworkSourcePackage(
  files: readonly DailyPaperworkSourceFile[],
): readonly VerifiedDailyPaperworkSource[] {
  if (files.length !== DAILY_PAPERWORK_KINDS.length)
    throw new Error("All six Daily Paperwork source files are required.");

  const filenames = new Set(files.map((file) => file.filename));
  if (filenames.size !== files.length)
    throw new Error("Daily Paperwork source filenames must be unique.");

  const verified = files.map((file) => verifySourceFile(file));
  const kinds = new Set(verified.map((file) => file.kind));
  if (
    kinds.size !== DAILY_PAPERWORK_KINDS.length ||
    DAILY_PAPERWORK_KINDS.some((kind) => !kinds.has(kind))
  )
    throw new Error("The Daily Paperwork source package is incomplete.");

  return DAILY_PAPERWORK_KINDS.map((kind) => {
    const source = verified.find((file) => file.kind === kind);
    if (!source)
      throw new Error("The Daily Paperwork source package is incomplete.");
    return source;
  });
}

export function summarizeDailyPaperworkSourcePackage(
  sources: readonly VerifiedDailyPaperworkSource[],
) {
  return {
    schemaVersion: 1 as const,
    sourceCount: sources.length,
    totalBytes: sources.reduce((total, source) => total + source.byteLength, 0),
    sources: sources.map(({ kind, byteLength, sha256 }) => ({
      kind,
      byteLength,
      sha256,
    })),
  };
}

function verifySourceFile(
  file: DailyPaperworkSourceFile,
): VerifiedDailyPaperworkSource {
  if (!/^[a-z][a-z0-9_]{0,63}\.json$/u.test(file.filename))
    throw new Error("Daily Paperwork source filenames are invalid.");
  if (file.bytes.byteLength < 2 || file.bytes.byteLength > MAX_SOURCE_BYTES)
    throw new Error("Daily Paperwork source file size is invalid.");

  let candidate: unknown;
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(file.bytes);
    candidate = JSON.parse(text) as unknown;
  } catch {
    throw new Error("Daily Paperwork source JSON is invalid.");
  }

  const source = sourceDefinitionSchema.parse(candidate);
  if (EXPECTED_FILE_BY_KIND[source.kind] !== file.filename)
    throw new Error("Daily Paperwork source filename does not match its kind.");

  return {
    kind: source.kind,
    filename: file.filename,
    byteLength: file.bytes.byteLength,
    sha256: createHash("sha256").update(file.bytes).digest("hex"),
    source,
  };
}

function uniqueStrings(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

function uniqueCodes(values: readonly Readonly<{ code: string }>[]): boolean {
  return new Set(values.map((value) => value.code)).size === values.length;
}
