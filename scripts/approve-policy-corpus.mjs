import { pathToFileURL } from "node:url";

import postgres from "postgres";

/**
 * Records owner approval for imported policy documents so the embedding step
 * can run after the owner has reviewed the imported evidence.
 *
 * The default mode is a read-only report. Writing requires both --apply and
 * --confirm-production-corpus-approval, and happens inside one transaction.
 *
 * This script never lowers a bar. It approves the review flags the owner is
 * responsible for and refuses anything whose recorded evidence disagrees with
 * the rows actually stored, rather than rewriting the evidence to fit.
 */

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
  const options = {
    apply: false,
    confirmed: false,
    reviewerId: "",
    documentVersionId: "",
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--apply") options.apply = true;
    else if (argument === "--confirm-production-corpus-approval")
      options.confirmed = true;
    else if (argument === "--reviewer-id") options.reviewerId = argv[++index];
    else if (argument === "--document-version")
      options.documentVersionId = argv[++index];
    else throw new Error("Unknown approval option");
  }
  for (const value of [options.reviewerId, options.documentVersionId]) {
    if (
      value !== "" &&
      (typeof value !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          value,
        ))
    )
      throw new Error("Invalid approval identifier");
  }
  if (options.apply && (!options.confirmed || !options.reviewerId))
    throw new Error(
      "Approval requires a reviewer and explicit production confirmation",
    );
  return options;
}

/**
 * Decides what approval would do to one document version.
 *
 * `blockers` are conditions approval cannot and must not fix. `changes` are the
 * review flags the owner is entitled to set. A version with any blocker is
 * skipped entirely, so one bad document cannot quietly ride along with 234
 * good ones.
 */
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
  // until this is set. Confirm you agree with that reading before applying.
  if (!row.indexed_at) changes.push("stamp the version indexed");
  if (row.version_lifecycle !== "active")
    changes.push("mark the version active");
  if (row.document_status !== "approved")
    changes.push("mark the document approved");

  if (blockers.length > 0) return { verdict: "blocked", blockers, changes: [] };
  if (changes.length === 0)
    return { verdict: "already-approved", blockers, changes };
  return { verdict: "will-approve", blockers, changes };
}

export function summarize(classified) {
  const totals = {
    total: classified.length,
    willApprove: 0,
    alreadyApproved: 0,
    blocked: 0,
    pages: 0,
    chunks: 0,
  };
  for (const item of classified) {
    if (item.verdict === "will-approve") {
      totals.willApprove += 1;
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

/**
 * Applies approval to one version in the order the database demands: pages and
 * chunks first, because a ready ingestion run refuses further edits to its
 * evidence, and the readiness trigger recounts approved pages and chunks at the
 * moment the run flips.
 */
export async function approveVersion(sql, row, reviewerId) {
  await sql`
    update app_private.policy_pages
       set review_status = 'approved'
     where ingestion_run_id = ${row.ingestion_run_id}
       and review_status <> 'approved'
  `;
  await sql`
    update app_private.policy_chunks
       set qa_approved = true,
           lifecycle_status = 'active'
     where ingestion_run_id = ${row.ingestion_run_id}
       and (qa_approved = false or lifecycle_status <> 'active')
  `;
  await sql`
    update app_private.policy_ingestion_runs
       set qa_status = 'approved',
           qa_reviewed_by = ${reviewerId},
           qa_reviewed_at = statement_timestamp(),
           status = 'ready'
     where id = ${row.ingestion_run_id}
  `;
  await sql`
    update app_private.policy_document_versions
       set approved_at = coalesce(approved_at, statement_timestamp()),
           indexed_at = coalesce(indexed_at, statement_timestamp()),
           lifecycle_status = 'active'
     where id = ${row.version_id}
  `;
  await sql`
    update app_private.policy_documents
       set status = 'approved'
     where id = ${row.document_id}
  `;
}

function line(text = "") {
  process.stdout.write(`${text}\n`);
}

export function printReport(classified) {
  const totals = summarize(classified);

  line("");
  line("POLICY CORPUS APPROVAL — DRY RUN (nothing has been changed)");
  line("=".repeat(64));
  line("");
  line(`Document versions examined : ${totals.total}`);
  line(`Would be approved          : ${totals.willApprove}`);
  line(`Already approved           : ${totals.alreadyApproved}`);
  line(`Blocked (needs attention)  : ${totals.blocked}`);
  line("");
  line(`Pages that would be approved  : ${totals.pages}`);
  line(`Chunks that would be approved : ${totals.chunks}`);
  line("");

  const blocked = classified.filter((item) => item.verdict === "blocked");
  if (blocked.length > 0) {
    line("BLOCKED — these will be skipped entirely");
    line("-".repeat(64));
    for (const item of blocked) {
      line(`  ${item.row.version_id}`);
      for (const reason of item.blockers) line(`      - ${reason}`);
    }
    line("");
  }

  line("WOULD APPROVE");
  line("-".repeat(64));
  for (const item of classified.filter((i) => i.verdict === "will-approve")) {
    line(
      `  ${item.row.version_id}  [${item.row.document_collection}]  ` +
        `${item.row.pages_total} pages, ${item.row.chunks_total} chunks`,
    );
  }
  line("");

  line("TO APPLY, RE-RUN WITH:");
  line("  node scripts/approve-policy-corpus.mjs --reviewer-id <uuid> \\");
  line("      --apply --confirm-production-corpus-approval");
  line("");
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
  if (options.apply && !options.confirmed) {
    line(
      "--apply also requires --confirm-production-corpus-approval. Nothing was changed.",
    );
    return 2;
  }
  if (options.apply && !options.reviewerId) {
    line(
      "--apply requires --reviewer-id. Run without --apply to see the choices.",
    );
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

    const rows = await STATE_QUERY(sql, facilityId, options.documentVersionId);
    if (rows.length === 0) {
      line("No policy document versions were found for that facility.");
      return 1;
    }
    const classified = rows.map((row) => ({
      row,
      ...classifyVersion(row),
    }));

    if (!options.apply) {
      printReport(classified);
      return 0;
    }

    const approvedCount = await applyApproval(sql, facilityId, options);
    const after = await STATE_QUERY(sql, facilityId, options.documentVersionId);
    const stillPending = after
      .map((row) => classifyVersion(row))
      .filter((item) => item.verdict === "will-approve").length;
    line(
      `Done. ${approvedCount} approved; ${stillPending} still not approved.`,
    );
    line("");
    line("Next: run the embedding step for each approved document version.");
    return 0;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

export async function applyApproval(sql, facilityId, options) {
  if (!options.apply || !options.confirmed || !options.reviewerId)
    throw new Error("Explicit approval confirmation required");
  return sql.begin(async (transaction) => {
    await transaction`set local lock_timeout = '5s'`;
    await transaction`set local statement_timeout = '60s'`;
    // Serialize evidence changes and reviewer revocation with approval. Reads
    // remain available; the small manually managed corpus is updated rarely.
    await transaction`lock table app_private.policy_documents, app_private.policy_document_versions, app_private.policy_ingestion_runs, app_private.policy_pages, app_private.policy_chunks, app_private.staff_members, app_private.user_accounts in share row exclusive mode`;
    const reviewers =
      await transaction`select staff.id from app_private.staff_members staff join app_private.user_accounts account on account.staff_member_id=staff.id where staff.id=${options.reviewerId} and staff.facility_id=${facilityId} and staff.status='active' and account.status='active' and account.role='administrator' and not account.must_change_passcode`;
    if (reviewers.length !== 1)
      throw new Error("Approval reviewer is unavailable");
    const current = await STATE_QUERY(
      transaction,
      facilityId,
      options.documentVersionId,
    );
    const approvable = current.filter(
      (row) => classifyVersion(row).verdict === "will-approve",
    );
    for (const row of approvable)
      await approveVersion(transaction, row, options.reviewerId);
    return approvable.length;
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
      "Corpus approval could not complete. No database or personnel details are logged.",
    );
    process.exitCode = 1;
  }
}
