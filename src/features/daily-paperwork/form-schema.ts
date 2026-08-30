import { z } from "zod";

const keySchema = z.string().regex(/^[a-z][a-z0-9_]{0,63}$/);
const sharedFieldShape = {
  key: keySchema,
  label: z.string().min(1).max(160),
  required: z.boolean(),
  help_text: z.string().min(1).max(500).optional(),
};

const textFieldSchema = z
  .object({
    ...sharedFieldShape,
    type: z.literal("text"),
    max_length: z.number().int().min(1).max(4000),
  })
  .strict();
const integerFieldSchema = z
  .object({
    ...sharedFieldShape,
    type: z.literal("integer"),
    minimum: z.number().int().min(-1_000_000).max(1_000_000),
    maximum: z.number().int().min(-1_000_000).max(1_000_000),
  })
  .strict()
  .refine((field) => field.minimum <= field.maximum);
const booleanFieldSchema = z
  .object({ ...sharedFieldShape, type: z.literal("boolean") })
  .strict();
const dateFieldSchema = z
  .object({ ...sharedFieldShape, type: z.literal("date") })
  .strict();
const timeFieldSchema = z
  .object({ ...sharedFieldShape, type: z.literal("time") })
  .strict();
const selectFieldSchema = z
  .object({
    ...sharedFieldShape,
    type: z.literal("select"),
    options: z
      .array(z.string().min(1).max(160))
      .min(1)
      .max(100)
      .refine((options) => new Set(options).size === options.length),
  })
  .strict();

export const dailyPaperworkFieldSchema = z.discriminatedUnion("type", [
  textFieldSchema,
  integerFieldSchema,
  booleanFieldSchema,
  dateFieldSchema,
  timeFieldSchema,
  selectFieldSchema,
]);

export const dailyPaperworkFormSchema = z
  .object({
    schema_version: z.literal(1),
    fields: z
      .array(dailyPaperworkFieldSchema)
      .max(256)
      .refine((fields) => uniqueKeys(fields)),
    tables: z
      .array(
        z
          .object({
            key: keySchema,
            label: z.string().min(1).max(160),
            help_text: z.string().min(1).max(500).optional(),
            min_rows: z.number().int().min(0).max(500),
            max_rows: z.number().int().min(0).max(500),
            columns: z
              .array(dailyPaperworkFieldSchema)
              .min(1)
              .max(64)
              .refine((columns) => uniqueKeys(columns)),
          })
          .strict()
          .refine((table) => table.min_rows <= table.max_rows),
      )
      .max(32)
      .refine((tables) => uniqueKeys(tables)),
  })
  .strict()
  .refine((schema) => schema.fields.length + schema.tables.length > 0);

export type DailyPaperworkField = z.infer<typeof dailyPaperworkFieldSchema>;
export type DailyPaperworkFormSchema = z.infer<typeof dailyPaperworkFormSchema>;
export type DailyPaperworkValue = string | number | boolean | null;
export type DailyPaperworkPayload = Readonly<{
  schema_version: 1;
  fields: Readonly<Record<string, DailyPaperworkValue>>;
  tables: Readonly<
    Record<string, readonly Readonly<Record<string, DailyPaperworkValue>>[]>
  >;
}>;

export function parseDailyPaperworkFormSchema(
  candidate: unknown,
): DailyPaperworkFormSchema {
  return dailyPaperworkFormSchema.parse(candidate);
}

export function parseDailyPaperworkPayload(
  schema: DailyPaperworkFormSchema,
  candidate: unknown,
  options: Readonly<{ allowIncomplete?: boolean }> = {},
): DailyPaperworkPayload {
  if (!isRecord(candidate) || candidate.schema_version !== 1)
    throw new Error("Daily Paperwork values are invalid.");
  if (
    !hasExactKeys(candidate, ["schema_version", "fields", "tables"]) ||
    !isRecord(candidate.fields) ||
    !isRecord(candidate.tables) ||
    !hasExactKeys(
      candidate.fields,
      schema.fields.map((field) => field.key),
    ) ||
    !hasExactKeys(
      candidate.tables,
      schema.tables.map((table) => table.key),
    )
  )
    throw new Error("Daily Paperwork values do not match the approved form.");

  const fields: Record<string, DailyPaperworkValue> = {};
  for (const field of schema.fields) {
    fields[field.key] = parseValue(
      field,
      candidate.fields[field.key],
      options.allowIncomplete === true,
    );
  }

  const tables: Record<
    string,
    readonly Readonly<Record<string, DailyPaperworkValue>>[]
  > = {};
  for (const table of schema.tables) {
    const rows = candidate.tables[table.key];
    if (
      !Array.isArray(rows) ||
      (rows.length < table.min_rows && options.allowIncomplete !== true) ||
      rows.length > table.max_rows
    )
      throw new Error("Daily Paperwork rows are invalid.");
    tables[table.key] = rows.map((row) => {
      if (
        !isRecord(row) ||
        !hasExactKeys(
          row,
          table.columns.map((column) => column.key),
        )
      )
        throw new Error("Daily Paperwork row values are invalid.");
      return Object.fromEntries(
        table.columns.map((column) => [
          column.key,
          parseValue(column, row[column.key], options.allowIncomplete === true),
        ]),
      );
    });
  }

  return { schema_version: 1, fields, tables };
}

export function createBlankDailyPaperworkRow(
  fields: readonly DailyPaperworkField[],
): Readonly<Record<string, null>> {
  return Object.fromEntries(fields.map((field) => [field.key, null]));
}

function parseValue(
  field: DailyPaperworkField,
  value: unknown,
  allowIncomplete: boolean,
): DailyPaperworkValue {
  if (value === null) {
    if (field.required && !allowIncomplete)
      throw new Error(`${field.label} is required.`);
    return null;
  }
  if (field.type === "text") {
    if (
      typeof value !== "string" ||
      value.length > field.max_length ||
      (field.required && value.trim().length === 0 && !allowIncomplete)
    )
      throw new Error(`${field.label} is invalid.`);
    return value;
  }
  if (field.type === "integer") {
    if (
      typeof value !== "number" ||
      !Number.isInteger(value) ||
      value < field.minimum ||
      value > field.maximum
    )
      throw new Error(`${field.label} must be a whole number.`);
    return value;
  }
  if (field.type === "boolean") {
    if (typeof value !== "boolean")
      throw new Error(`${field.label} is invalid.`);
    return value;
  }
  if (field.type === "date") {
    if (typeof value !== "string" || !z.iso.date().safeParse(value).success)
      throw new Error(`${field.label} must be a date.`);
    return value;
  }
  if (field.type === "time") {
    if (
      typeof value !== "string" ||
      !/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(value)
    )
      throw new Error(`${field.label} must be a time.`);
    return value;
  }
  if (typeof value !== "string" || !field.options.includes(value))
    throw new Error(`${field.label} must use an approved choice.`);
  return value;
}

function uniqueKeys(values: readonly Readonly<{ key: string }>[]): boolean {
  return new Set(values.map((value) => value.key)).size === values.length;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Readonly<Record<string, unknown>>,
  expected: readonly string[],
): boolean {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return (
    actual.length === sortedExpected.length &&
    actual.every((key, index) => key === sortedExpected[index])
  );
}
