import { Buffer } from "node:buffer";

import type { ExportableReportRevision } from "@/server/incidents/get-report-revision-for-export";

export const REPORT_DOCX_TEMPLATE_VERSION =
  "guided-operations-reviewed-report-v1";
export const REPORT_DOCX_MEDIA_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

type ZipEntry = Readonly<{ name: string; content: Buffer }>;

export function createReportRevisionDocx(
  report: ExportableReportRevision,
): Buffer {
  const entries: readonly ZipEntry[] = [
    xmlEntry("[Content_Types].xml", contentTypesXml()),
    xmlEntry("_rels/.rels", packageRelationshipsXml()),
    xmlEntry("docProps/core.xml", corePropertiesXml(report)),
    xmlEntry("docProps/app.xml", appPropertiesXml()),
    xmlEntry("word/document.xml", documentXml(report)),
    xmlEntry("word/styles.xml", stylesXml()),
    xmlEntry("word/_rels/document.xml.rels", documentRelationshipsXml()),
  ];
  return createStoredZip(entries);
}

function xmlEntry(name: string, value: string): ZipEntry {
  return { name, content: Buffer.from(value, "utf8") };
}

function documentXml(report: ExportableReportRevision) {
  const reportLabel =
    report.reportType === "first_person"
      ? "First-person report"
      : "Cover letter";
  const narrative = normalizeLines(report.narrative)
    .map((line) => paragraph(line))
    .join("");
  return xml(
    `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
      `<w:body>` +
      heading("Guided Operations — Reviewed Report", 1) +
      paragraph(`Incident: ${report.incidentNumber}`) +
      paragraph(`Incident name: ${report.incidentName}`) +
      paragraph(`Report type: ${reportLabel}`) +
      paragraph(`Saved report revision: ${report.revisionNumber}`) +
      paragraph(`Revision created: ${formatUtc(report.createdAt)}`) +
      heading("Reviewed narrative", 2) +
      narrative +
      paragraph(
        `Record reference: ${report.reportId} / revision ${report.revisionNumber}`,
        "GOFooter",
      ) +
      `<w:sectPr><w:pgSz w:w="12240" w:h="15840"/>` +
      `<w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080" ` +
      `w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>` +
      `</w:body></w:document>`,
  );
}

function contentTypesXml() {
  return xml(
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
      `<Default Extension="xml" ContentType="application/xml"/>` +
      `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
      `<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>` +
      `<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>` +
      `<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>` +
      `</Types>`,
  );
}

function packageRelationshipsXml() {
  return xml(
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>` +
      `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>` +
      `<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>` +
      `</Relationships>`,
  );
}

function documentRelationshipsXml() {
  return xml(
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
      `</Relationships>`,
  );
}

function corePropertiesXml(report: ExportableReportRevision) {
  const created = new Date(report.createdAt).toISOString();
  return xml(
    `<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ` +
      `xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" ` +
      `xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
      `<dc:title>Guided Operations Reviewed Report</dc:title>` +
      `<dc:creator>Guided Operations</dc:creator>` +
      `<cp:lastModifiedBy>Guided Operations</cp:lastModifiedBy>` +
      `<dcterms:created xsi:type="dcterms:W3CDTF">${escapeXml(created)}</dcterms:created>` +
      `<dcterms:modified xsi:type="dcterms:W3CDTF">${escapeXml(created)}</dcterms:modified>` +
      `<cp:revision>${report.revisionNumber}</cp:revision>` +
      `</cp:coreProperties>`,
  );
}

function appPropertiesXml() {
  return xml(
    `<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" ` +
      `xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">` +
      `<Application>Guided Operations</Application><AppVersion>1.0</AppVersion>` +
      `</Properties>`,
  );
}

function stylesXml() {
  return xml(
    `<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
      `<w:style w:type="paragraph" w:default="1" w:styleId="Normal">` +
      `<w:name w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="160" w:line="276" w:lineRule="auto"/></w:pPr>` +
      `<w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="22"/></w:rPr></w:style>` +
      `<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/>` +
      `<w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>` +
      `<w:pPr><w:spacing w:before="240" w:after="160"/><w:outlineLvl w:val="0"/></w:pPr>` +
      `<w:rPr><w:b/><w:sz w:val="32"/></w:rPr></w:style>` +
      `<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/>` +
      `<w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>` +
      `<w:pPr><w:spacing w:before="240" w:after="120"/><w:outlineLvl w:val="1"/></w:pPr>` +
      `<w:rPr><w:b/><w:sz w:val="26"/></w:rPr></w:style>` +
      `<w:style w:type="paragraph" w:styleId="GOFooter"><w:name w:val="GO Footer"/>` +
      `<w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="360"/></w:pPr>` +
      `<w:rPr><w:color w:val="666666"/><w:sz w:val="16"/></w:rPr></w:style>` +
      `</w:styles>`,
  );
}

function heading(text: string, level: 1 | 2) {
  return paragraph(text, `Heading${level}`);
}

function paragraph(text: string, style?: string) {
  const styleXml = style ? `<w:pStyle w:val="${style}"/>` : "";
  return `<w:p><w:pPr>${styleXml}</w:pPr><w:r><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
}

function normalizeLines(value: string) {
  return value.replaceAll("\r\n", "\n").replaceAll("\r", "\n").split("\n");
}

function formatUtc(value: string) {
  return new Date(value).toISOString().replace("T", " ").replace("Z", " UTC");
}

function xml(body: string) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${body}`;
}

function escapeXml(value: string) {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function createStoredZip(entries: readonly ZipEntry[]) {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const checksum = crc32(entry.content);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0x0021, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(entry.content.length, 18);
    local.writeUInt32LE(entry.content.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, name, entry.content);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0x0021, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(entry.content.length, 20);
    central.writeUInt32LE(entry.content.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);
    offset += local.length + name.length + entry.content.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...localParts, centralDirectory, end]);
}

function crc32(value: Buffer) {
  let crc = 0xffffffff;
  for (const byte of value) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1)
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
