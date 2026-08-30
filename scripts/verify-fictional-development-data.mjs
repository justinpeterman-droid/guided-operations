import { createHmac } from "node:crypto";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

import nextEnv from "@next/env";
import postgres from "postgres";

import { validateFictionalDevelopmentAuditRequest } from "./fictional-test-administrator-bootstrap-guard.mjs";

const repositoryRoot = resolve(import.meta.dirname, "..");
const expectedFixture = Object.freeze({
  displayName: "Fictional Test Administrator",
  employeeNumber: "FICTIONAL-TEST-ADMIN",
  employeeNumberHint: "DMIN",
  facilitySlug: "fictional-training-facility",
});
const allowedNonemptyApplicationTables = new Set([
  "audit_events",
  "auth_attempt_events",
  "facilities",
  "staff_members",
  "user_accounts",
]);

function employeeDigest(employeeNumber, pepper) {
  return createHmac("sha256", pepper)
    .update(employeeNumber.normalize("NFKC").trim().toUpperCase(), "utf8")
    .digest("hex");
}

export function evaluateFictionalDevelopmentSnapshot(snapshot) {
  const counts = snapshot.applicationTableCounts;
  if (
    !counts ||
    counts.facilities !== 1 ||
    counts.staff_members !== 1 ||
    counts.user_accounts !== 1 ||
    snapshot.fixtureMatches !== 1 ||
    snapshot.authUserCount !== 1 ||
    snapshot.fixtureAuthMatches !== 1
  ) {
    throw new Error(
      "Development identity data is not the exact fictional fixture",
    );
  }

  for (const [table, count] of Object.entries(counts)) {
    if (
      !Number.isInteger(count) ||
      count < 0 ||
      (!allowedNonemptyApplicationTables.has(table) && count !== 0)
    ) {
      throw new Error("Development contains unexpected application rows");
    }
  }
  if (
    snapshot.storageBucketCount !== 2 ||
    snapshot.expectedPrivateBucketCount !== 2 ||
    snapshot.storageObjectCount !== 0
  ) {
    throw new Error(
      "Development Storage is outside the fictional empty boundary",
    );
  }

  return Object.freeze({
    status: "verified",
    applicationTableCount: Object.keys(counts).length,
    fictionalFixtureAccounts: 1,
    operationalRows: 0,
    metadataRows:
      (counts.audit_events ?? 0) + (counts.auth_attempt_events ?? 0),
    privateStorageBuckets: 2,
    storageObjects: 0,
  });
}

async function readSnapshot(sql, environment) {
  const tables = await sql.unsafe(
    `select table_name
       from information_schema.tables
      where table_schema = 'app_private'
        and table_type = 'BASE TABLE'
      order by table_name`,
  );
  const applicationTableCounts = {};
  for (const { table_name: tableName } of tables) {
    if (!/^[a-z][a-z0-9_]{1,62}$/.test(tableName)) {
      throw new Error("Development schema inventory is invalid");
    }
    const [row] = await sql.unsafe(
      `select count(*)::integer as count from app_private.${tableName}`,
    );
    applicationTableCounts[tableName] = Number(row?.count);
  }

  const lookupDigest = employeeDigest(
    expectedFixture.employeeNumber,
    environment.EMPLOYEE_LOOKUP_PEPPER,
  );
  const [identity] = await sql.unsafe(
    `select
       count(*) filter (
         where staff.employee_lookup_hash = $1::text
           and staff.employee_number_hint = $2::text
           and staff.display_name = $3::text
           and facility.slug = $4::text
           and account.sign_in_alias ~ '^go-fictional-test-[0-9a-f-]{36}@auth\\.invalid$'
       )::integer as fixture_matches,
       (select count(*)::integer from auth.users) as auth_user_count,
       count(auth_user.id) filter (
         where auth_user.email = account.sign_in_alias
           and auth_user.email ~ '^go-fictional-test-[0-9a-f-]{36}@auth\\.invalid$'
       )::integer as fixture_auth_matches
     from app_private.user_accounts as account
     join app_private.staff_members as staff on staff.id = account.staff_member_id
     join app_private.facilities as facility on facility.id = staff.facility_id
     left join auth.users as auth_user on auth_user.id = account.auth_user_id`,
    [
      lookupDigest,
      expectedFixture.employeeNumberHint,
      expectedFixture.displayName,
      expectedFixture.facilitySlug,
    ],
  );
  const [storage] = await sql.unsafe(
    `select
       (select count(*)::integer from storage.buckets) as bucket_count,
       (select count(*)::integer
          from storage.buckets
         where id in ('policy-sources', 'generated-exports')
           and public is false) as expected_private_bucket_count,
       (select count(*)::integer from storage.objects) as object_count`,
  );

  return {
    applicationTableCounts,
    fixtureMatches: Number(identity?.fixture_matches),
    authUserCount: Number(identity?.auth_user_count),
    fixtureAuthMatches: Number(identity?.fixture_auth_matches),
    storageBucketCount: Number(storage?.bucket_count),
    expectedPrivateBucketCount: Number(storage?.expected_private_bucket_count),
    storageObjectCount: Number(storage?.object_count),
  };
}

export async function verifyFictionalDevelopmentData({
  argv = process.argv.slice(2),
  environment = process.env,
  sqlFactory = postgres,
} = {}) {
  validateFictionalDevelopmentAuditRequest({ argv, environment });
  const sql = sqlFactory(environment.SUPABASE_DB_URL, {
    max: 1,
    prepare: false,
    idle_timeout: 5,
    connect_timeout: 10,
    ssl: "require",
  });
  try {
    return evaluateFictionalDevelopmentSnapshot(
      await readSnapshot(sql, environment),
    );
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function main() {
  const { loadEnvConfig } = nextEnv;
  loadEnvConfig(repositoryRoot);
  try {
    const result = await verifyFictionalDevelopmentData();
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch {
    process.stderr.write(
      "Fictional Development data-boundary verification failed.\n",
    );
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  await main();
}
