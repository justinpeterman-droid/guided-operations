import "server-only";

import { createHmac } from "node:crypto";

import postgres from "postgres";
import { z } from "zod";

import { getAuthServerEnvironment } from "@/lib/env/auth-server";
import { adminStepUpInternals } from "@/server/auth/admin-step-up";

import type { PreparedDailyPaperworkImport } from "./daily-paperwork-import-manifest";

export type DailyPaperworkTemplatePackageStore = Readonly<{
  register(input: DailyPaperworkTemplatePackageRegistration): Promise<string>;
}>;

export type DailyPaperworkTemplatePackageRegistration = Readonly<{
  actorAuthUserId: string;
  sessionId: string;
  authVersion: number;
  stepUpToken: string;
  stepUpRequestId: string;
  idempotencyKey: string;
  hmacKey: string;
  prepared: PreparedDailyPaperworkImport;
}>;

type PersistenceRegistration = Readonly<{
  actorAuthUserId: string;
  sessionId: string;
  authVersion: number;
  stepUpTokenDigest: string;
  stepUpRequestId: string;
  packageDigest: string;
  mappingVersion: string;
  sourceAuthority: string;
  sourceRevision: string;
  activeFrom: string;
  expectedCurrentPackageDigest: string | null;
  rollbackOfPackageDigest: string | null;
  idempotencyKeyDigest: string;
  entries: readonly Readonly<Record<string, unknown>>[];
}>;

type Persistence = Readonly<{
  register(input: PersistenceRegistration): Promise<string>;
}>;

let templatePackageSql: ReturnType<typeof postgres> | undefined;

function sql(): ReturnType<typeof postgres> {
  if (templatePackageSql) return templatePackageSql;
  templatePackageSql = postgres(getAuthServerEnvironment().SUPABASE_DB_URL, {
    max: 1,
    prepare: false,
    idle_timeout: 5,
  });
  return templatePackageSql;
}

function createPostgresPersistence(): Persistence {
  const client = sql();
  return {
    async register(input) {
      const entriesJson = JSON.stringify(input.entries);
      const rows = await client<ReadonlyArray<{ package_id: string }>>`
        select app_private.register_daily_paperwork_template_package(
          ${input.actorAuthUserId}::uuid,
          ${input.sessionId}::uuid,
          ${input.authVersion},
          ${input.stepUpTokenDigest},
          ${input.stepUpRequestId}::uuid,
          ${input.packageDigest},
          ${input.mappingVersion},
          ${input.sourceAuthority},
          ${input.sourceRevision},
          ${input.activeFrom}::date,
          ${input.expectedCurrentPackageDigest}::text,
          ${input.rollbackOfPackageDigest}::text,
          ${input.idempotencyKeyDigest},
          ${entriesJson}::jsonb
        ) as package_id
      `;
      return z.uuid().parse(rows.at(0)?.package_id);
    },
  };
}

/** Server-only adapter over the atomic six-definition registration routine. */
export function createDailyPaperworkTemplatePackageStore(
  persistence: Persistence = createPostgresPersistence(),
): DailyPaperworkTemplatePackageStore {
  return {
    register(input) {
      const purpose = input.prepared.manifest.metadata.rollbackOfPackageDigest
        ? "paperwork.template_rollback"
        : "paperwork.template_import";
      return persistence.register({
        actorAuthUserId: input.actorAuthUserId,
        sessionId: input.sessionId,
        authVersion: input.authVersion,
        stepUpTokenDigest: adminStepUpInternals.digestStepUpToken(
          input.stepUpToken,
          purpose,
          input.hmacKey,
        ),
        stepUpRequestId: input.stepUpRequestId,
        packageDigest: input.prepared.manifest.packageDigest,
        mappingVersion: input.prepared.manifest.mappingVersion,
        sourceAuthority: input.prepared.manifest.metadata.sourceAuthority,
        sourceRevision: input.prepared.manifest.metadata.sourceRevision,
        activeFrom: input.prepared.manifest.metadata.activeFrom,
        expectedCurrentPackageDigest:
          input.prepared.manifest.metadata.expectedCurrentPackageDigest,
        rollbackOfPackageDigest:
          input.prepared.manifest.metadata.rollbackOfPackageDigest,
        idempotencyKeyDigest: digestIdempotencyKey(
          input.idempotencyKey,
          input.hmacKey,
        ),
        entries: input.prepared.templates.map((template, index) => ({
          kind: template.kind,
          title: template.title,
          source_byte_length:
            input.prepared.manifest.entries[index].sourceByteLength,
          source_sha256: input.prepared.manifest.entries[index].sourceSha256,
          mapped_sha256: input.prepared.manifest.entries[index].mappedSha256,
          print_orientation: template.printOrientation,
          structure: template.structure,
          field_schema: template.fieldSchema,
        })),
      });
    },
  };
}

function digestIdempotencyKey(value: string, key: string): string {
  return createHmac("sha256", key)
    .update("daily_paperwork.template_package.key")
    .update("\u0000")
    .update(value)
    .digest("hex");
}

export const dailyPaperworkTemplatePackageStoreInternals = {
  digestIdempotencyKey,
};
