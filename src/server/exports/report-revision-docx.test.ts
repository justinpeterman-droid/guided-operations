import { describe, expect, it } from "vitest";

import {
  createReportRevisionDocx,
  REPORT_DOCX_TEMPLATE_VERSION,
} from "./report-revision-docx";

const report = {
  reportId: "11111111-1111-4111-8111-111111111111",
  reportRevisionId: "22222222-2222-4222-8222-222222222222",
  revisionNumber: 2,
  incidentNumber: "FICTIONAL-001",
  incidentName: "Fictional drill & review <only>",
  reportType: "first_person" as const,
  narrative:
    "First fictional paragraph.\nSecond <fictional> & reviewed paragraph.",
  schemaVersion: 2,
  sourceIncidentRevisionId: "33333333-3333-4333-8333-333333333333",
  createdAt: "2026-08-27T14:30:00Z",
};

describe("reviewed report DOCX", () => {
  it("creates the same valid stored ZIP package for the same immutable revision", () => {
    const first = createReportRevisionDocx(report);
    const second = createReportRevisionDocx(report);
    expect(second.equals(first)).toBe(true);
    expect(first.readUInt32LE(0)).toBe(0x04034b50);
    expect(first.readUInt32LE(first.length - 22)).toBe(0x06054b50);

    const entries = readStoredZip(first);
    expect([...entries.keys()]).toEqual([
      "[Content_Types].xml",
      "_rels/.rels",
      "docProps/core.xml",
      "docProps/app.xml",
      "word/document.xml",
      "word/styles.xml",
      "word/_rels/document.xml.rels",
    ]);
    expect(entries.get("word/document.xml")?.toString("utf8")).toContain(
      "Saved report revision: 2",
    );
  });

  it("escapes document text and removes invalid XML control characters", () => {
    const document = readStoredZip(
      createReportRevisionDocx({
        ...report,
        narrative: 'Fictional <tag> & "quoted"\u0001 text.',
      }),
    )
      .get("word/document.xml")
      ?.toString("utf8");
    expect(document).toContain(
      "Fictional &lt;tag&gt; &amp; &quot;quoted&quot; text.",
    );
    expect(document).not.toContain("<tag>");
    expect(document).not.toContain("\u0001");
    expect(REPORT_DOCX_TEMPLATE_VERSION).toMatch(/^[a-z0-9._-]+$/);
  });
});

function readStoredZip(value: Buffer) {
  const entries = new Map<string, Buffer>();
  let offset = 0;
  while (
    offset + 30 <= value.length &&
    value.readUInt32LE(offset) === 0x04034b50
  ) {
    expect(value.readUInt16LE(offset + 8)).toBe(0);
    const size = value.readUInt32LE(offset + 18);
    const nameLength = value.readUInt16LE(offset + 26);
    const extraLength = value.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const contentStart = nameStart + nameLength + extraLength;
    const name = value
      .subarray(nameStart, nameStart + nameLength)
      .toString("utf8");
    entries.set(name, value.subarray(contentStart, contentStart + size));
    offset = contentStart + size;
  }
  return entries;
}
