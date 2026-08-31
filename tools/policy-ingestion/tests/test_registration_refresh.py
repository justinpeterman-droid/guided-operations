from __future__ import annotations

import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from guided_policy_ingestion.registration import (
    PolicyRegistrar,
    PolicySource,
    RegistrationErrorSafe,
    RightsAttestation,
    _production_connection_options,
)


class ScriptedCursor:
    def __init__(self, responses):
        self.responses = list(responses)
        self.current = []
        self.statements: list[tuple[str, tuple | None]] = []

    def execute(self, statement, parameters=None):
        normalized = " ".join(str(statement).split())
        self.statements.append((normalized, parameters))
        self.current = self.responses.pop(0) if self.responses else []

    def fetchone(self):
        return self.current[0] if self.current else None

    def fetchall(self):
        return list(self.current)


class ProductionConnectionOptionsTests(unittest.TestCase):
    def test_local_registration_does_not_force_tls_options(self):
        self.assertEqual(
            _production_connection_options("postgresql://local/db", "local", None),
            {},
        )

    def test_production_preserves_a_fully_verified_dsn(self):
        self.assertEqual(
            _production_connection_options(
                "postgresql://user:pass@db.example.test/postgres"
                "?sslmode=verify-full&sslrootcert=C%3A%5Ccerts%5Cprod.cer",
                "production",
                None,
            ),
            {},
        )

    def test_production_can_add_verify_full_without_downgrading_the_dsn(self):
        self.assertEqual(
            _production_connection_options(
                "postgresql://user:pass@db.example.test/postgres",
                "production",
                "C:\\certs\\prod.cer",
            ),
            {
                "sslmode": "verify-full",
                "sslrootcert": "C:\\certs\\prod.cer",
            },
        )

    def test_production_rejects_require_even_when_a_root_is_available(self):
        with self.assertRaisesRegex(
            RegistrationErrorSafe,
            "sslmode=verify-full",
        ):
            _production_connection_options(
                "postgresql://user:pass@db.example.test/postgres"
                "?sslmode=require&sslrootcert=C%3A%5Ccerts%5Cprod.cer",
                "production",
                None,
            )

    def test_production_requires_a_trusted_root_certificate(self):
        with self.assertRaisesRegex(
            RegistrationErrorSafe,
            "SUPABASE_DB_SSLROOTCERT or sslrootcert",
        ):
            _production_connection_options(
                "postgresql://user:pass@db.example.test/postgres"
                "?sslmode=verify-full",
                "production",
                None,
            )


class RegistrationRefreshTests(unittest.TestCase):
    def source(
        self,
        sha: str = "a" * 64,
        collection: str = "SD",
        filename: str = "Count Sheet.pdf",
    ) -> PolicySource:
        return PolicySource(
            source_sha256=sha,
            collection=collection,
            source_filename=filename,
            media_type="application/pdf",
            page_count=3,
            byte_size=2048,
        )

    def attestation(self) -> RightsAttestation:
        return RightsAttestation(
            reviewer_staff_member_id="11111111-1111-4111-8111-111111111111",
            evidence_ref="O-021",
        )

    def registrar(self) -> PolicyRegistrar:
        return PolicyRegistrar(
            "postgresql://local/db",
            "22222222-2222-4222-8222-222222222222",
            "local",
        )

    def test_separate_run_collision_gets_a_deterministic_hash_suffix(self):
        source = self.source()
        cursor = ScriptedCursor(
            [
                [],
                [
                    (
                        "33333333-3333-4333-8333-333333333333",
                        "Different Title",
                        "BMU policies",
                    )
                ],
                [],
                [("44444444-4444-4444-8444-444444444444",)],
                [],
                [],
            ]
        )

        self.registrar()._insert(
            cursor,
            source,
            "count-sheet",
            self.attestation(),
            "2026-08-31",
            datetime(2026, 8, 31, tzinfo=timezone.utc),
        )

        document_insert = next(
            call
            for call in cursor.statements
            if "insert into app_private.policy_documents" in call[0]
        )
        self.assertEqual(document_insert[1][1], "count-sheet-aaaaaaaa")
        self.assertEqual(document_insert[1][3], "SD")

    def test_annual_replacement_reuses_identity_and_supersedes_current_first(self):
        old_version = "55555555-5555-4555-8555-555555555555"
        cursor = ScriptedCursor(
            [
                [
                    (
                        "44444444-4444-4444-8444-444444444444",
                        "count-sheet-aaaaaaaa",
                    )
                ],
                [(old_version,)],
                [],
                [],
            ]
        )

        self.registrar()._insert(
            cursor,
            self.source(sha="b" * 64),
            "count-sheet",
            self.attestation(),
            "2027-08-31",
            datetime(2027, 8, 31, tzinfo=timezone.utc),
        )

        update_index = next(
            index
            for index, call in enumerate(cursor.statements)
            if "update app_private.policy_document_versions" in call[0]
        )
        insert_index = next(
            index
            for index, call in enumerate(cursor.statements)
            if "insert into app_private.policy_document_versions" in call[0]
        )
        self.assertLess(update_index, insert_index)
        self.assertEqual(cursor.statements[update_index][1], (old_version,))
        self.assertEqual(cursor.statements[insert_index][1][8], old_version)
        self.assertFalse(
            any(
                "insert into app_private.policy_documents" in statement
                for statement, _ in cursor.statements
            )
        )

    def test_ambiguous_existing_identity_fails_closed(self):
        cursor = ScriptedCursor(
            [
                [
                    ("33333333-3333-4333-8333-333333333333", "count-sheet-a"),
                    ("44444444-4444-4444-8444-444444444444", "count-sheet-b"),
                ]
            ]
        )

        with self.assertRaisesRegex(RegistrationErrorSafe, "ambiguous"):
            self.registrar()._insert(
                cursor,
                self.source(),
                "count-sheet",
                self.attestation(),
                "2026-08-31",
                datetime(2026, 8, 31, tzinfo=timezone.utc),
            )


if __name__ == "__main__":
    unittest.main()
