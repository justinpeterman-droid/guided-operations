from __future__ import annotations

import hashlib
import os
import sys
import tempfile
import unittest
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from guided_policy_ingestion.chunking import chunk_pages
from guided_policy_ingestion.config import ChunkingConfig, ExtractionConfig
from guided_policy_ingestion.importers.supabase import SupabaseImporter
from guided_policy_ingestion.models import NormalizedPage, SourceFile, ValidationResult


@unittest.skipUnless(
    os.environ.get("POLICY_INGESTION_INTEGRATION_DB_URL"),
    "set POLICY_INGESTION_INTEGRATION_DB_URL to run the local Supabase import test",
)
class SupabaseImportIntegrationTests(unittest.TestCase):
    def test_imports_private_fictional_page_and_chunk_as_awaiting_review(self) -> None:
        import psycopg

        database_url = os.environ["POLICY_INGESTION_INTEGRATION_DB_URL"]
        document_id = uuid.uuid4()
        version_id = uuid.uuid4()
        with tempfile.TemporaryDirectory() as temporary:
            source_path = Path(temporary) / "fictional-import.docx"
            source_path.write_bytes(b"fictional import source")
            source_sha = hashlib.sha256(source_path.read_bytes()).hexdigest()
            with psycopg.connect(database_url) as connection:
                with connection.cursor() as cursor:
                    cursor.execute("select id from app_private.facilities order by created_at limit 1")
                    facility_id = cursor.fetchone()[0]
                    cursor.execute(
                        """
                        insert into app_private.policy_documents (
                          id, facility_id, stable_key, title, collection, status
                        ) values (%s, %s, %s, %s, 'SD', 'approved')
                        """,
                        (document_id, facility_id, f"fictional-import-{document_id.hex}", "Fictional Import Policy"),
                    )
                    cursor.execute(
                        """
                        insert into app_private.policy_document_versions (
                          id, document_id, version_label, source_sha256, storage_path,
                          media_type, page_count, source_filename
                        ) values (%s, %s, 'fictional-v1', %s, %s, %s, 1, %s)
                        """,
                        (
                            version_id,
                            document_id,
                            source_sha,
                            f"fictional-import/{source_sha}.docx",
                            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                            source_path.name,
                        ),
                    )
                connection.commit()
            source = SourceFile(
                source_path,
                "SD",
                f"SD/{source_path.name}",
                source_path.name,
                source_sha,
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                source_path.stat().st_size,
            )
            text = "This is fictional policy text used only to test the private import transaction."
            page = NormalizedPage(
                1,
                "F-1",
                text,
                hashlib.sha256(text.encode()).hexdigest(),
                "native",
                "Fictional heading",
                "Fictional heading",
            )
            extraction = ExtractionConfig()
            chunking = ChunkingConfig()
            chunks = chunk_pages(source, (page,), chunking, extraction.sha256)
            tool_root = Path(__file__).resolve().parents[1]
            repository_root = tool_root.parent.parent
            importer = SupabaseImporter(
                database_url,
                str(facility_id),
                "local",
                repository_root,
                tool_root,
            )
            run_id = importer.import_document(
                source,
                (page,),
                chunks,
                ValidationResult("awaiting_review", (), (), ()),
                extraction,
                chunking,
                "mineru",
                "3.4.5",
                None,
                1,
            )
            try:
                with psycopg.connect(database_url) as connection:
                    with connection.cursor() as cursor:
                        cursor.execute(
                            "select collection::text, status::text, page_count, chunk_count from app_private.policy_ingestion_runs where id = %s",
                            (run_id,),
                        )
                        self.assertEqual(cursor.fetchone(), ("SD", "awaiting_review", 1, 1))
                        cursor.execute("select count(*) from app_private.policy_pages where ingestion_run_id = %s", (run_id,))
                        self.assertEqual(cursor.fetchone()[0], 1)
                        cursor.execute("select count(*) from app_private.policy_chunks where ingestion_run_id = %s", (run_id,))
                        self.assertEqual(cursor.fetchone()[0], 1)
            finally:
                with psycopg.connect(database_url) as connection:
                    with connection.cursor() as cursor:
                        cursor.execute("delete from app_private.policy_chunks where ingestion_run_id = %s", (run_id,))
                        cursor.execute("delete from app_private.policy_pages where ingestion_run_id = %s", (run_id,))
                        cursor.execute("delete from app_private.policy_ingestion_runs where id = %s", (run_id,))
                        cursor.execute("delete from app_private.policy_document_versions where id = %s", (version_id,))
                        cursor.execute("delete from app_private.policy_documents where id = %s", (document_id,))
                    connection.commit()


if __name__ == "__main__":
    unittest.main()
