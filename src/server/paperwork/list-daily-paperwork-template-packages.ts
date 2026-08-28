import "server-only";

import postgres from "postgres";
import { z } from "zod";

import { getAuthServerEnvironment } from "@/lib/env/auth-server";
import {
  authorizeCurrentSession,
  type CurrentSessionClient,
} from "@/server/auth/current-session";

const packageRowSchema = z
  .object({
    package_id: z.uuid(),
    package_digest: z.string().regex(/^[a-f0-9]{64}$/u),
    mapping_version: z.literal("daily-paperwork-source-to-form-v1"),
    source_authority: z.string().trim().min(1).max(160),
    source_revision: z.string().trim().min(1).max(160),
    active_from: z.iso.date(),
    rollback_of_package_digest: z
      .string()
      .regex(/^[a-f0-9]{64}$/u)
      .nullable(),
    source_count: z.literal(6),
    total_source_bytes: z.number().int().min(12).max(1_536_000),
    approved_at: z.iso.datetime({ offset: true }),
  })
  .strict();

export type DailyPaperworkTemplatePackageSummary = Readonly<{
  packageId: string;
  packageDigest: string;
  mappingVersion: "daily-paperwork-source-to-form-v1";
  sourceAuthority: string;
  sourceRevision: string;
  activeFrom: string;
  rollbackOfPackageDigest: string | null;
  sourceCount: 6;
  totalSourceBytes: number;
  approvedAt: string;
}>;

export type ListDailyPaperworkTemplatePackagesResult =
  | Readonly<{
      kind: "listed";
      packages: readonly DailyPaperworkTemplatePackageSummary[];
    }>
  | Readonly<{ kind: "denied" }>
  | Readonly<{ kind: "unavailable" }>;

export type DailyPaperworkTemplatePackageHistoryStore = Readonly<{
  list(
    facilityId: string,
    limit: number,
  ): Promise<readonly DailyPaperworkTemplatePackageSummary[]>;
}>;

type PackageRow = z.infer<typeof packageRowSchema>;
type Persistence = Readonly<{
  list(facilityId: string, limit: number): Promise<unknown>;
}>;

let packageHistorySql: ReturnType<typeof postgres> | undefined;

function sql(): ReturnType<typeof postgres> {
  packageHistorySql ??= postgres(getAuthServerEnvironment().SUPABASE_DB_URL, {
    max: 1,
    prepare: false,
    idle_timeout: 5,
  });
  return packageHistorySql;
}

function createPostgresPersistence(): Persistence {
  const client = sql();
  return {
    list(facilityId, limit) {
      return client`
        select
          package.id::text as package_id,
          package.package_digest,
          package.mapping_version,
          package.source_authority,
          package.source_revision,
          package.active_from::text as active_from,
          rollback.package_digest as rollback_of_package_digest,
          package.source_count,
          package.total_source_bytes,
          to_char(
            package.approved_at at time zone 'UTC',
            'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
          ) as approved_at
        from app_private.daily_paperwork_template_packages as package
        left join app_private.daily_paperwork_template_packages as rollback
          on rollback.id = package.rollback_of_package_id
        where package.facility_id = ${facilityId}::uuid
        order by package.approved_at desc, package.id desc
        limit ${limit}
      `;
    },
  };
}

/** Reads value-free package evidence from the private database. */
export function createDailyPaperworkTemplatePackageHistoryStore(
  persistence: Persistence = createPostgresPersistence(),
): DailyPaperworkTemplatePackageHistoryStore {
  return {
    async list(facilityId, limit) {
      const parsedFacilityId = z.uuid().safeParse(facilityId);
      const parsedLimit = z.number().int().min(1).max(25).safeParse(limit);
      if (!parsedFacilityId.success || !parsedLimit.success) {
        throw new Error("Daily Paperwork package history request is invalid.");
      }
      const rows = z
        .array(packageRowSchema)
        .parse(await persistence.list(parsedFacilityId.data, parsedLimit.data));
      return rows.map(mapPackageRow);
    },
  };
}

/** Lists only the current administrator facility's value-free package history. */
export async function listDailyPaperworkTemplatePackagesForCurrentSession(
  client: CurrentSessionClient,
  limit: number,
  store: DailyPaperworkTemplatePackageHistoryStore = createDailyPaperworkTemplatePackageHistoryStore(),
): Promise<ListDailyPaperworkTemplatePackagesResult> {
  const session = await authorizeCurrentSession(client, {
    requiredRole: "administrator",
  });
  if (!session.allowed) return { kind: "denied" };

  try {
    return {
      kind: "listed",
      packages: await store.list(session.account.facilityId, limit),
    };
  } catch {
    return { kind: "unavailable" };
  }
}

function mapPackageRow(row: PackageRow): DailyPaperworkTemplatePackageSummary {
  return {
    packageId: row.package_id,
    packageDigest: row.package_digest,
    mappingVersion: row.mapping_version,
    sourceAuthority: row.source_authority,
    sourceRevision: row.source_revision,
    activeFrom: row.active_from,
    rollbackOfPackageDigest: row.rollback_of_package_digest,
    sourceCount: row.source_count,
    totalSourceBytes: row.total_source_bytes,
    approvedAt: row.approved_at,
  };
}
