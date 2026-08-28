from __future__ import annotations

import sys
import unittest
from argparse import Namespace
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from guided_policy_ingestion.connection_guard import require_approved_production_connection
from guided_policy_ingestion.cli import _importer
from guided_policy_ingestion.importers.supabase import ImportErrorSafe

PROJECT_REF = "abcdefghijklmnopqrst"


class ProductionConnectionGuardTests(unittest.TestCase):
    def test_accepts_matching_direct_supabase_url(self) -> None:
        require_approved_production_connection(
            f"postgresql://postgres:fictional@db.{PROJECT_REF}.supabase.co:5432/postgres",
            PROJECT_REF,
        )

    def test_accepts_matching_pooler_supabase_url(self) -> None:
        require_approved_production_connection(
            f"postgresql://postgres.{PROJECT_REF}:fictional@aws-0-us-east-1.pooler.supabase.com:6543/postgres",
            PROJECT_REF,
        )

    def test_rejects_localhost_even_when_labeled_production(self) -> None:
        with self.assertRaisesRegex(ImportErrorSafe, "approved Supabase project"):
            require_approved_production_connection(
                "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
                PROJECT_REF,
            )

    def test_rejects_a_different_supabase_project(self) -> None:
        with self.assertRaisesRegex(ImportErrorSafe, "does not identify"):
            require_approved_production_connection(
                "postgresql://postgres:fictional@db.zyxwvutsrqponmlkjihg.supabase.co:5432/postgres",
                PROJECT_REF,
            )

    def test_rejects_downgradeable_tls_mode(self) -> None:
        with self.assertRaisesRegex(ImportErrorSafe, "TLS mode"):
            require_approved_production_connection(
                f"postgresql://postgres:fictional@db.{PROJECT_REF}.supabase.co:5432/postgres?sslmode=disable",
                PROJECT_REF,
            )

    def test_rejects_missing_or_malformed_approved_project_ref(self) -> None:
        with self.assertRaisesRegex(ImportErrorSafe, "SUPABASE_PROJECT_REF"):
            require_approved_production_connection(
                f"postgresql://postgres:fictional@db.{PROJECT_REF}.supabase.co:5432/postgres",
                "",
            )

    def test_controlled_cli_import_rejects_localhost_labeled_production(self) -> None:
        arguments = Namespace(
            import_supabase=True,
            source_data="controlled-policy",
            target_environment="production",
            confirm_controlled_production_import=True,
        )
        with patch.dict(
            "os.environ",
            {
                "SUPABASE_DB_URL": "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
                "GUIDED_OPERATIONS_FACILITY_ID": "00000000-0000-0000-0000-000000000001",
                "SUPABASE_PROJECT_REF": PROJECT_REF,
            },
            clear=True,
        ):
            with self.assertRaisesRegex(ImportErrorSafe, "approved Supabase project"):
                _importer(arguments, Path(__file__).resolve().parents[1])

    def test_controlled_cli_import_accepts_matching_production_project(self) -> None:
        arguments = Namespace(
            import_supabase=True,
            source_data="controlled-policy",
            target_environment="production",
            confirm_controlled_production_import=True,
        )
        with patch.dict(
            "os.environ",
            {
                "SUPABASE_DB_URL": f"postgresql://postgres:fictional@db.{PROJECT_REF}.supabase.co:5432/postgres",
                "GUIDED_OPERATIONS_FACILITY_ID": "00000000-0000-0000-0000-000000000001",
                "SUPABASE_PROJECT_REF": PROJECT_REF,
            },
            clear=True,
        ):
            self.assertIsNotNone(_importer(arguments, Path(__file__).resolve().parents[1]))

    def test_fictional_local_import_keeps_local_database_support(self) -> None:
        arguments = Namespace(
            import_supabase=True,
            source_data="fictional",
            target_environment="local",
            confirm_controlled_production_import=False,
        )
        with patch.dict(
            "os.environ",
            {
                "SUPABASE_DB_URL": "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
                "GUIDED_OPERATIONS_FACILITY_ID": "00000000-0000-0000-0000-000000000001",
            },
            clear=True,
        ):
            self.assertIsNotNone(_importer(arguments, Path(__file__).resolve().parents[1]))


if __name__ == "__main__":
    unittest.main()
