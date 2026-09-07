import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import postgres from "postgres";
import { inspectCorpus } from "./inspect-policy-corpus.mjs";
const target = process.env.CORPUS_TOOLS_TEST_DATABASE_URL;
it(
  "inspects fictional evidence in a read-only transaction without approving content",
  { skip: !target },
  async () => {
    const url = new URL(target);
    assert.equal(url.hostname, "127.0.0.1");
    assert.ok(["54322", "57322"].includes(url.port));
    assert.equal(url.pathname, "/postgres");
    const sql = postgres(target, { max: 1 });
    const rollback = new Error("fictional fixture rollback");
    try {
      const existing = await inspectCorpus(
        sql,
        (await sql`select id from app_private.facilities`)[0].id,
      );
      assert.ok(Array.isArray(existing));
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
          assert.ok(match[1].includes("set status = 'ready',"));
          assert.ok(match[1].includes("qa_status = 'approved',"));
          const fixture = match[1]
            .replace("set status = 'ready',", "set status = 'awaiting_review',")
            .replace("qa_status = 'approved',", "qa_status = 'pending',");
          await tx.unsafe(fixture);
          const [facility] = await tx`select id from app_private.facilities`;
          const adapter = {
            begin: async (fn) =>
              fn((strings, ...values) => {
                const query = strings.join("?");
                if (query.startsWith("set transaction")) {
                  assert.equal(
                    query,
                    "set transaction isolation level repeatable read, read only",
                  );
                  return [];
                }
                return tx(strings, ...values);
              }),
          };
          const rows = await inspectCorpus(
            adapter,
            facility.id,
            "20202020-2020-4020-8020-202020202020",
          );
          assert.equal(rows.length, 1);
          assert.equal(rows[0].ingestion_qa_status, "pending");
          const [run] =
            await tx`select qa_status from app_private.policy_ingestion_runs where id='30303030-3030-4030-8030-303030303030'`;
          assert.equal(run.qa_status, "pending");
          throw rollback;
        }),
        (error) => error === rollback,
      );
    } finally {
      await sql.end();
    }
  },
);
