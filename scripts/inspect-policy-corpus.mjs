import { pathToFileURL } from "node:url";

import postgres from "postgres";

/** Read-only evidence inspection. This tool cannot approve or activate content. */

const RIGHTS_ALLOWED = new Set([
  "approved_internal_search",
  "approved_full_reader",
]);

/** Ingestion states that approval must never try to revive. */
const INGESTION_DEAD_ENDS = new Set(["failed", "quarantined", "superseded"]);

/** Document states that approval must never try to revive. */
const DOCUMENT_DEAD_ENDS = new Set(["superseded", "retired"]);

/** True only for a database on this machine, where TLS is not available. */
export function isLoopbackDatabase(databaseUrl) {
  try {
    const { hostname } = new URL(databaseUrl);
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "[::1]"
    );
  } catch {
    return false;
  }
}

export function parseArguments(argv) {
  const options = { documentVersionId: "" };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] !== "--document-version")
      throw new Error("Only read-only inspection is supported");
    const value = argv[++index];
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value ?? "",
      )
    )
      throw new Error("Invalid version identifier");
    options.documentVersionId = value;
  }
  return options;
}

/** Reports evidence gaps without granting review or activation authority. */
export function classifyVersion(row, now = new Date()) {
  const blockers = [];
  const changes = [];

  if (!RIGHTS_ALLOWED.has(row.rights_status))
    blockers.push(`rights_status is ${row.rights_status}`);
  if (!row.external_ai_allowed) blockers.push("external_ai_allowed is false");
  if (row.rights_review_due_at && new Date(row.rights_review_due_at) <= now)
    blockers.push("the rights review has expired");
  if (!row.is_current) blockers.push("this is not the current version");
  if (!["pending", "active"].includes(row.version_lifecycle))
    blockers.push("the version lifecycle cannot be approved");
  if (
    row.ingestion_qa_status === "rejected" ||
    row.rejected_pages !== 0 ||
    row.blocked_chunks !== 0
  )
    blockers.push("reviewed evidence contains rejected or inactive content");
  if (DOCUMENT_DEAD_ENDS.has(row.document_status))
    blockers.push(`document status is ${row.document_status}`);
  if (INGESTION_DEAD_ENDS.has(row.ingestion_status))
    blockers.push(`ingestion status is ${row.ingestion_status}`);
  if (row.failure_count !== 0)
    blockers.push(`the import recorded ${row.failure_count} failure(s)`);
  if (!row.completed_at) blockers.push("the import never recorded completion");
  if (row.ingestion_collection !== row.document_collection)
    blockers.push("the ingestion collection does not match the document");
  if (row.ingestion_sha !== row.version_sha)
    blockers.push("the ingestion source hash does not match the version");
  if (row.pages_total === 0) blockers.push("no pages were stored");
  if (row.chunks_total === 0) blockers.push("no chunks were stored");

  // The database requires the recorded counts to equal the approved rows at the
  // moment the run becomes ready. Approving every page and chunk makes approved
  // equal total, so a recorded count that already disagrees with the stored
  // rows means the evidence is wrong. Report it; never overwrite it to fit.
  if (row.recorded_page_count !== row.pages_total)
    blockers.push(
      `recorded page_count ${row.recorded_page_count} does not match ${row.pages_total} stored pages`,
    );
  if (row.recorded_chunk_count !== row.chunks_total)
    blockers.push(
      `recorded chunk_count ${row.recorded_chunk_count} does not match ${row.chunks_total} stored chunks`,
    );

  const pagesToApprove = row.pages_total - row.pages_approved;
  const chunksToApprove = row.chunks_total - row.chunks_approved;
  if (pagesToApprove > 0) changes.push(`approve ${pagesToApprove} page(s)`);
  if (chunksToApprove > 0) changes.push(`approve ${chunksToApprove} chunk(s)`);
  if (row.ingestion_qa_status !== "approved")
    changes.push("mark the ingestion run QA-approved");
  if (row.ingestion_status !== "ready")
    changes.push("move the ingestion run to ready");
  if (!row.approved_at) changes.push("stamp the version approved");
  // The embedding query requires indexed_at, so embedding can never start
  // until this is set; inspection never changes this state.
  if (!row.indexed_at) changes.push("stamp the version indexed");
  if (row.version_lifecycle !== "active")
    changes.push("mark the version active");
  if (row.document_status !== "approved")
    changes.push("mark the document approved");

  if (blockers.length > 0) return { verdict: "blocked", blockers, changes: [] };
  if (changes.length === 0)
    return { verdict: "already-approved", blockers, changes };
  return { verdict: "needs-review", blockers, changes };
}

export function summarize(classified) {
  const totals = {
    total: classified.length,
    needsReview: 0,
    alreadyApproved: 0,
    blocked: 0,
    pages: 0,
    chunks: 0,
  };
  for (const item of classified) {
    if (item.verdict === "needs-review") {
      totals.needsReview += 1;
      totals.pages += item.row.pages_total - item.row.pages_approved;
      totals.chunks += item.row.chunks_total - item.row.chunks_approved;
    } else if (item.verdict === "already-approved") totals.alreadyApproved += 1;
    else totals.blocked += 1;
  }
  return totals;
}

const STATE_QUERY = (sql, facilityId, documentVersionId) => sql`
  select distinct on (version.id)
    document.id::text            as document_id,
    document.title               as title,
    document.stable_key          as stable_key,
    document.collection::text    as document_collection,
    document.status::text        as document_status,
    version.id::text             as version_id,
    version.approved_at          as approved_at,
    version.indexed_at           as indexed_at,
    version.lifecycle_status::text as version_lifecycle,
    version.is_current           as is_current,
    version.rights_status::text  as rights_status,
    version.external_ai_allowed  as external_ai_allowed,
    version.rights_review_due_at as rights_review_due_at,
    version.source_sha256        as version_sha,
    run.id::text                 as ingestion_run_id,
    run.status::text             as ingestion_status,
    run.qa_status::text          as ingestion_qa_status,
    run.completed_at             as completed_at,
    run.failure_count            as failure_count,
    run.page_count               as recorded_page_count,
    run.chunk_count              as recorded_chunk_count,
    run.collection::text         as ingestion_collection,
    run.source_sha256            as ingestion_sha,
    (select count(*)::int from app_private.policy_pages page where page.ingestion_run_id = run.id and page.review_status = 'rejected') as rejected_pages,
    (select count(*)::int from app_private.policy_chunks chunk where chunk.ingestion_run_id = run.id and chunk.lifecycle_status not in ('pending','active')) as blocked_chunks,
    (select count(*)::int from app_private.policy_pages page
       where page.ingestion_run_id = run.id)                     as pages_total,
    (select count(*)::int from app_private.policy_pages page
       where page.ingestion_run_id = run.id
         and page.review_status = 'approved')                    as pages_approved,
    (select count(*)::int from app_private.policy_chunks chunk
       where chunk.ingestion_run_id = run.id)                    as chunks_total,
    (select count(*)::int from app_private.policy_chunks chunk
       where chunk.ingestion_run_id = run.id
         and chunk.lifecycle_status = 'active'
         and chunk.qa_approved)                                  as chunks_approved
  from app_private.policy_documents as document
  join app_private.policy_document_versions as version
    on version.document_id = document.id
  join app_private.policy_ingestion_runs as run
    on run.document_version_id = version.id
  where document.facility_id = ${facilityId}
    ${documentVersionId ? sql`and version.id = ${documentVersionId}` : sql``}
  order by version.id, run.started_at desc
`;

function line(text = "") {
  process.stdout.write(`${text}\n`);
}

export function printReport(classified) {
  const totals = summarize(classified);

  line("");
  line("POLICY CORPUS EVIDENCE — READ ONLY");
  line("=".repeat(64));
  line("");
  line(`Document versions examined : ${totals.total}`);
  line(`Eligible for review          : ${totals.needsReview}`);
  line(`Already approved           : ${totals.alreadyApproved}`);
  line(`Blocked (needs attention)  : ${totals.blocked}`);
  line("");
  line(`Pages awaiting review  : ${totals.pages}`);
  line(`Chunks awaiting review : ${totals.chunks}`);
  line("");

  const blocked = classified.filter((item) => item.verdict === "blocked");
  if (blocked.length > 0) {
    line("BLOCKED — evidence requires attention");
    line("-".repeat(64));
    for (const item of blocked) {
      line(`  ${item.row.version_id}`);
      for (const reason of item.blockers) line(`      - ${reason}`);
    }
    line("");
  }

  line("ELIGIBLE FOR HUMAN REVIEW");
  line("-".repeat(64));
  for (const item of classified.filter((i) => i.verdict === "needs-review")) {
    line(
      `  ${item.row.version_id}  [${item.row.document_collection}]  ` +
        `${item.row.pages_total} pages, ${item.row.chunks_total} chunks`,
    );
  }
  line("");

  line(
    "Evidence eligibility is not approval or permission to activate retrieval.",
  );
  line(
    "Use the controlled corpus protocol for authenticated review and qualification.",
  );
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArguments(argv);
  const databaseUrl = process.env.SUPABASE_DB_URL ?? "";
  let facilityId = process.env.GUIDED_OPERATIONS_FACILITY_ID ?? "";
  if (
    facilityId &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      facilityId,
    )
  )
    throw new Error("Invalid facility identifier");
  if (!databaseUrl) {
    line("SUPABASE_DB_URL is required. Nothing was read or changed.");
    return 2;
  }
  const sql = postgres(databaseUrl, {
    max: 1,
    prepare: false,
    connect_timeout: 10,
    // Anything that is not the local loopback database is treated as remote and
    // must negotiate TLS. A local Supabase container does not offer it.
    ssl: isLoopbackDatabase(databaseUrl) ? false : "require",
  });

  try {
    // The facilities table carries a database check constraint allowing exactly
    // one row, so the single facility is unambiguous when it is not configured.
    if (!facilityId) {
      const facilities = await sql`
        select id::text as id
        from app_private.facilities
      `;
      if (facilities.length !== 1) {
        line(
          `Expected exactly one facility but found ${facilities.length}. Set GUIDED_OPERATIONS_FACILITY_ID.`,
        );
        return 2;
      }
      facilityId = facilities[0].id;
      line(`Facility: ${facilityId}`);
    }

    const rows = await inspectCorpus(
      sql,
      facilityId,
      options.documentVersionId,
    );
    if (rows.length === 0) {
      line("No policy document versions were found for that facility.");
      return 1;
    }
    const classified = rows.map((row) => ({
      row,
      ...classifyVersion(row),
    }));

    printReport(classified);
    return classified.some((item) => item.verdict === "blocked") ? 1 : 0;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

export async function inspectCorpus(sql, facilityId, documentVersionId = "") {
  return sql.begin(async (tx) => {
    await tx`set transaction isolation level repeatable read, read only`;
    return STATE_QUERY(tx, facilityId, documentVersionId);
  });
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    process.exitCode = await main();
  } catch {
    console.error(
      "Corpus inspection could not complete. No database or personnel details are logged.",
    );
    process.exitCode = 1;
  }
}
