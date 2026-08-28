import "server-only";

import { createHash } from "node:crypto";

import { z } from "zod";

import { dailyPaperworkKindSchema } from "@/features/daily-paperwork/catalog";

import type { VerifiedDailyPaperworkSource } from "./daily-paperwork-source-package";
import {
  DAILY_PAPERWORK_MAPPING_VERSION,
  mapDailyPaperworkTemplate,
  type MappedDailyPaperworkTemplate,
} from "./daily-paperwork-template-mapper";

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u);
const boundedEvidenceText = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .refine((value) => !/[\u0000-\u001f<>]/u.test(value));

const metadataSchema = z
  .object({
    facilityId: z.uuid(),
    sourceAuthority: boundedEvidenceText,
    sourceRevision: boundedEvidenceText,
    rightsStatus: z.literal("approved_internal_use"),
    activeFrom: z.iso.date(),
    expectedCurrentPackageDigest: sha256Schema.nullable(),
    rollbackOfPackageDigest: sha256Schema.nullable(),
  })
  .strict();

export type DailyPaperworkImportMetadata = z.infer<typeof metadataSchema>;

export type DailyPaperworkImportManifestEntry = Readonly<{
  kind: z.infer<typeof dailyPaperworkKindSchema>;
  sourceByteLength: number;
  sourceSha256: string;
  mappedSha256: string;
}>;

export type DailyPaperworkImportManifest = Readonly<{
  schemaVersion: 1;
  mappingVersion: typeof DAILY_PAPERWORK_MAPPING_VERSION;
  packageDigest: string;
  metadata: DailyPaperworkImportMetadata;
  entries: readonly DailyPaperworkImportManifestEntry[];
}>;

export type PreparedDailyPaperworkImport = Readonly<{
  manifest: DailyPaperworkImportManifest;
  templates: readonly MappedDailyPaperworkTemplate[];
}>;

/**
 * Builds the immutable review/apply manifest. The caller must derive facilityId
 * from the current authoritative session and keep templates server-only.
 */
export function prepareDailyPaperworkImport(
  verified: readonly VerifiedDailyPaperworkSource[],
  metadata: DailyPaperworkImportMetadata,
): PreparedDailyPaperworkImport {
  const parsedMetadata = metadataSchema.parse(metadata);
  const templates = verified.map(mapDailyPaperworkTemplate);
  if (templates.length !== 6)
    throw new Error("The Daily Paperwork import package is incomplete.");

  const entries = templates.map((template, index) => {
    const source = verified[index];
    if (!source || source.kind !== template.kind)
      throw new Error("The Daily Paperwork import package order is invalid.");
    return {
      kind: template.kind,
      sourceByteLength: source.byteLength,
      sourceSha256: source.sha256,
      mappedSha256: digestJson({
        title: template.title,
        printOrientation: template.printOrientation,
        mappingVersion: template.mappingVersion,
        structure: template.structure,
        fieldSchema: template.fieldSchema,
      }),
    };
  });

  const packageDigest = digestJson({
    schemaVersion: 1,
    mappingVersion: DAILY_PAPERWORK_MAPPING_VERSION,
    metadata: parsedMetadata,
    entries,
  });

  return {
    manifest: {
      schemaVersion: 1,
      mappingVersion: DAILY_PAPERWORK_MAPPING_VERSION,
      packageDigest,
      metadata: parsedMetadata,
      entries,
    },
    templates,
  };
}

/** Value-free evidence safe for a protected review response or audit metadata. */
export function summarizeDailyPaperworkImport(
  prepared: PreparedDailyPaperworkImport,
) {
  return {
    schemaVersion: prepared.manifest.schemaVersion,
    mappingVersion: prepared.manifest.mappingVersion,
    packageDigest: prepared.manifest.packageDigest,
    sourceCount: prepared.manifest.entries.length,
    totalBytes: prepared.manifest.entries.reduce(
      (total, entry) => total + entry.sourceByteLength,
      0,
    ),
    entries: prepared.manifest.entries,
  };
}

function digestJson(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(value), "utf8")
    .digest("hex");
}
