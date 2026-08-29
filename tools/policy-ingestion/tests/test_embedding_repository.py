from __future__ import annotations

import os
import unittest
import uuid

from guided_policy_ingestion.embeddings.supabase import SupabaseEmbeddingRepository


class EmbeddingRepositoryEligibilityTests(unittest.TestCase):
    def test_shared_eligibility_requires_the_complete_page_range_approval(self) -> None:
        repository = SupabaseEmbeddingRepository(
            "postgresql://fictional.invalid/postgres",
            "11111111-1111-4111-8111-111111111111",
            "local",
        )

        predicate = " ".join(repository._eligible_where().split())

        self.assertIn(
            "app_private.policy_chunk_pages_are_approved( chunk.ingestion_run_id, chunk.page_start, chunk.page_end )",
            predicate,
        )
        self.assertIn("ingestion.status = 'ready'", predicate)
        self.assertIn("ingestion.qa_status = 'approved'", predicate)
        self.assertIn("chunk.lifecycle_status = 'active'", predicate)
        self.assertIn("chunk.qa_approved", predicate)


@unittest.skipUnless(
    os.environ.get("POLICY_INGESTION_INTEGRATION_DB_URL"),
    "set POLICY_INGESTION_INTEGRATION_DB_URL to run the local repository test",
)
class EmbeddingRepositoryIntegrationTests(unittest.TestCase):
    def test_lock_query_fails_closed_for_an_unknown_chunk(self) -> None:
        import psycopg

        database_url = os.environ["POLICY_INGESTION_INTEGRATION_DB_URL"]
        with psycopg.connect(database_url) as connection, connection.cursor() as cursor:
            cursor.execute("select id::text from app_private.facilities order by id limit 1")
            facility_id = cursor.fetchone()[0]

        repository = SupabaseEmbeddingRepository(database_url, facility_id, "local")
        with repository.lock_eligible(
            str(uuid.uuid4()),
            "fictional.openai-v1",
            (str(uuid.uuid4()),),
        ) as eligible:
            self.assertFalse(eligible)


if __name__ == "__main__":
    unittest.main()
