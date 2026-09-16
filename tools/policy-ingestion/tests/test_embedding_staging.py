from __future__ import annotations

from contextlib import contextmanager
import os
from pathlib import Path
import re
import unittest
from unittest.mock import patch
from urllib.parse import urlparse

from guided_policy_ingestion.embeddings.supabase import SupabaseEmbeddingRepository


@unittest.skipUnless(
    os.environ.get("POLICY_INGESTION_INTEGRATION_DB_URL"),
    "requires the fictional local database",
)
class EmbeddingStagingTests(unittest.TestCase):
    def test_reviewed_pending_version_embeds_without_search_or_reader_access(self) -> None:
        import psycopg

        target = os.environ["POLICY_INGESTION_INTEGRATION_DB_URL"]
        url = urlparse(target)
        self.assertEqual(url.hostname, "127.0.0.1")
        self.assertIn(url.port, (54322, 57322))
        self.assertEqual(url.path, "/postgres")
        connection = psycopg.connect(target)
        version_id = "20202020-2020-4020-8020-202020202020"
        chunk_id = "40404040-4040-4040-8040-404040404040"
        profile = "fictional.staging-test"

        @contextmanager
        def transaction_connection():
            # Use real repository SQL inside one rollback-only fictional fixture.
            yield connection

        def execute(query, params=None):
            return connection.execute(query, params)

        try:
            source = (
                Path(__file__).resolve().parents[3]
                / "supabase/tests/policy_ingestion_provenance.test.sql"
            ).read_text(encoding="utf-8")
            match = re.search(r"select lives_ok\(\s*\$\$(.*?)\$\$", source, re.S)
            self.assertIsNotNone(match)
            fixture = match.group(1).replace(
                "'fictional-provenance/'",
                "'10101010-1010-4010-8010-101010101010/'",
            )
            execute(fixture)
            execute(
                """
                update app_private.policy_document_versions
                set lifecycle_status = 'pending', indexed_at = null,
                    rights_status = 'approved_full_reader'
                where id = %s
                """,
                (version_id,),
            )
            execute(
                """
                insert into app_private.embedding_profiles
                  (profile_key, provider, model, dimensions, enabled)
                values (%s, 'fictional', 'staging-test', 3, true)
                """,
                (profile,),
            )
            # Same-facility valid session; the final active positive control proves
            # that empty results below are caused by staging, not missing authority.
            execute(
                """
                insert into auth.users (id, email)
                values ('65656565-6565-4565-8565-656565656565',
                        'fictional-staging@invalid.example');
                insert into app_private.user_accounts
                  (auth_user_id, staff_member_id, sign_in_alias, role, status,
                   must_change_passcode, auth_version)
                values ('65656565-6565-4565-8565-656565656565',
                        '15151515-1515-4515-8515-151515151515',
                        'fictional-staging@accounts.invalid', 'officer',
                        'active', false, 1);
                select set_config('request.jwt.claim.sub',
                    '65656565-6565-4565-8565-656565656565', true);
                select set_config('request.jwt.claims',
                    '{"app_metadata":{"auth_version":1}}', true);
                """
            )
            facility = execute("select id::text from app_private.facilities").fetchone()[0]
            repository = SupabaseEmbeddingRepository(target, facility, "local")

            def visible_counts():
                execute("set local role authenticated")
                try:
                    search = execute(
                        """
                        select count(*) from api.retrieve_policy_passages_v4(
                          'Fictional bounded policy', '[1,0,0]'::extensions.vector,
                          %s, 8, array[%s::uuid], null
                        )
                        """,
                        (profile, version_id),
                    ).fetchone()[0]
                    reader = execute(
                        "select count(*) from api.get_policy_source_reader(%s)",
                        (version_id,),
                    ).fetchone()[0]
                    return search, reader
                finally:
                    execute("reset role")

            with patch.object(repository, "_connect", transaction_connection):
                self.assertEqual(repository.count_eligible(version_id, profile), (1, 0))
                self.assertEqual(len(repository.next_chunks(version_id, profile, 16)), 1)
                with repository.lock_eligible(version_id, profile, (chunk_id,)) as eligible:
                    self.assertTrue(eligible)
                self.assertEqual(visible_counts(), (0, 0))

                # Revoked rights, QA, stale versions and mixed activation markers
                # cannot use the newly admitted staging path.
                cases = [
                    "update app_private.policy_document_versions set external_ai_allowed=false",
                    "update app_private.policy_document_versions set approved_at=null",
                    "update app_private.policy_document_versions set is_current=false",
                    "update app_private.policy_document_versions set lifecycle_status='quarantined'",
                    "update app_private.policy_document_versions set indexed_at=statement_timestamp()",
                    "update app_private.policy_document_versions set lifecycle_status='active'",
                    "update app_private.policy_ingestion_runs set status='awaiting_review', qa_status='pending'",
                ]
                for mutation in cases:
                    with self.subTest(mutation=mutation):
                        execute("savepoint staging_negative")
                        try:
                            table_id = (
                                "30303030-3030-4030-8030-303030303030"
                                if "policy_ingestion_runs" in mutation else version_id
                            )
                            execute(mutation + " where id=%s", (table_id,))
                            with self.assertRaises(RuntimeError):
                                repository.count_eligible(version_id, profile)
                            self.assertEqual(repository.next_chunks(version_id, profile, 16), ())
                            with repository.lock_eligible(version_id, profile, (chunk_id,)) as eligible:
                                self.assertFalse(eligible)
                        finally:
                            execute("rollback to savepoint staging_negative")
                            execute("release savepoint staging_negative")

                # Simulate a persisted provider vector; no provider or real corpus
                # is used. Resume skips it but cannot activate the source.
                execute(
                    """
                    insert into app_private.policy_chunk_embeddings
                      (policy_chunk_id, profile_key, embedding)
                    values (%s, %s, '[1,0,0]'::extensions.vector)
                    """,
                    (chunk_id, profile),
                )
                self.assertEqual(repository.count_eligible(version_id, profile), (1, 1))
                self.assertEqual(repository.next_chunks(version_id, profile, 16), ())
                with repository.lock_eligible(version_id, profile, (chunk_id,)) as eligible:
                    self.assertFalse(eligible)
                self.assertEqual(visible_counts(), (0, 0))
                state = execute(
                    "select lifecycle_status::text, indexed_at from app_private.policy_document_versions where id=%s",
                    (version_id,),
                ).fetchone()
                self.assertEqual(state, ("pending", None))

                # Fictional positive control only, not a production approval recipe.
                execute(
                    """
                    update app_private.policy_document_versions
                    set lifecycle_status='active', indexed_at=statement_timestamp()
                    where id=%s
                    """,
                    (version_id,),
                )
                self.assertEqual(visible_counts(), (1, 1))
                self.assertEqual(repository.count_eligible(version_id, profile), (1, 1))
        finally:
            connection.rollback()
            connection.close()


if __name__ == "__main__":
    unittest.main()
