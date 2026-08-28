import { describe, expect, it } from "vitest";

import {
  createBlankDailyPaperworkRow,
  parseDailyPaperworkFormSchema,
  parseDailyPaperworkPayload,
} from "./form-schema";

const schema = parseDailyPaperworkFormSchema({
  schema_version: 1,
  fields: [
    {
      key: "supervisor",
      label: "Fictional supervisor",
      type: "text",
      required: true,
      max_length: 100,
    },
  ],
  tables: [
    {
      key: "entries",
      label: "Fictional entries",
      min_rows: 0,
      max_rows: 2,
      columns: [
        {
          key: "ready",
          label: "Ready",
          type: "boolean",
          required: false,
        },
      ],
    },
  ],
});

describe("Daily Paperwork form contracts", () => {
  it("accepts an exact fictional payload", () => {
    expect(
      parseDailyPaperworkPayload(schema, {
        schema_version: 1,
        fields: { supervisor: "Fictional Supervisor" },
        tables: { entries: [{ ready: true }] },
      }),
    ).toEqual({
      schema_version: 1,
      fields: { supervisor: "Fictional Supervisor" },
      tables: { entries: [{ ready: true }] },
    });
  });

  it("permits an incomplete server-provided blank only while loading", () => {
    const blank = {
      schema_version: 1,
      fields: { supervisor: null },
      tables: { entries: [] },
    };
    expect(() => parseDailyPaperworkPayload(schema, blank)).toThrow(
      "Fictional supervisor is required.",
    );
    expect(
      parseDailyPaperworkPayload(schema, blank, { allowIncomplete: true }),
    ).toEqual(blank);
  });

  it("rejects undeclared browser values and duplicate schema keys", () => {
    expect(() =>
      parseDailyPaperworkPayload(schema, {
        schema_version: 1,
        fields: { supervisor: "Fictional", extra: "blocked" },
        tables: { entries: [] },
      }),
    ).toThrow("do not match");
    expect(() =>
      parseDailyPaperworkFormSchema({
        schema_version: 1,
        fields: [
          {
            key: "same",
            label: "One",
            type: "boolean",
            required: false,
          },
          {
            key: "same",
            label: "Two",
            type: "boolean",
            required: false,
          },
        ],
        tables: [],
      }),
    ).toThrow();
  });

  it("creates a blank repeating row from approved columns", () => {
    expect(createBlankDailyPaperworkRow(schema.tables[0].columns)).toEqual({
      ready: null,
    });
  });
});
