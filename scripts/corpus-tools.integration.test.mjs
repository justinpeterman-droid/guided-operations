import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import postgres from "postgres";
import { applyApproval } from "./approve-policy-corpus.mjs";
const target = process.env.CORPUS_TOOLS_TEST_DATABASE_URL;
it(
  "approves fictional evidence under real database constraints and serializes concurrent evidence edits",
  { skip: !target },
  async () => {
    const url = new URL(target);
    assert.equal(url.hostname, "127.0.0.1");
    assert.ok(["54322", "57322"].includes(url.port));
    assert.equal(url.pathname, "/postgres");
    const sql = postgres(target, { max: 1 });
    const rollback = new Error("fictional fixture rollback");
    try {
      await assert.rejects(
        sql.begin(async (tx) => {
          const source = readFileSync(
            new URL(
              "../supabase/tests/policy_ingestion_provenance.test.sql",
              import.meta.url,
            ),
            "utf8",
          );
          const match = source.match(/select lives_ok\(\s*\$\$([\s\S]*?)\$\$/);
          assert.ok(match);
          const fixture = match[1]
            .replace("set status = 'ready',", "set status = 'awaiting_review',")
            .replace("qa_status = 'approved',", "qa_status = 'pending',");
          await tx.unsafe(fixture);
          const [facility] = await tx`select id from app_private.facilities`;
          await tx`insert into auth.users(id,email) values ('16161616-1616-4616-8616-161616161616','fictional-corpus-admin@example.invalid')`;
          await tx`insert into app_private.user_accounts(auth_user_id,staff_member_id,sign_in_alias,role,status,must_change_passcode) values ('16161616-1616-4616-8616-161616161616','15151515-1515-4515-8515-151515151515','fictional-corpus-admin-auth@example.invalid','administrator','active',false)`;
          const options = {
            apply: true,
            confirmed: true,
            reviewerId: "15151515-1515-4515-8515-151515151515",
            documentVersionId: "20202020-2020-4020-8020-202020202020",
          };
          assert.equal(
            await applyApproval(
              { begin: (fn) => fn(tx) },
              facility.id,
              options,
            ),
            1,
          );
          assert.equal(
            await applyApproval(
              { begin: (fn) => fn(tx) },
              facility.id,
              options,
            ),
            0,
          );
          const [run] =
            await tx`select status,qa_status from app_private.policy_ingestion_runs where id='30303030-3030-4030-8030-303030303030'`;
          assert.equal(run.status, "ready");
          assert.equal(run.qa_status, "approved");
          await assert.rejects(
            () =>
              applyApproval({ begin: (fn) => fn(tx) }, facility.id, {
                ...options,
                reviewerId: "17171717-1717-4717-8717-171717171717",
              }),
            /reviewer/,
          );
          const competing = postgres(target, { max: 1 });
          try {
            await assert.rejects(
              competing.begin(async (other) => {
                await other`set local lock_timeout='50ms'`;
                await other`lock table app_private.policy_pages in row exclusive mode`;
              }),
              (error) => error.code === "55P03",
            );
          } finally {
            await competing.end();
          }
          throw rollback;
        }),
        (error) => error === rollback,
      );
    } finally {
      await sql.end();
    }
  },
);
