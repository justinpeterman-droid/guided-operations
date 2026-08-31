from __future__ import annotations

import unittest

from guided_policy_ingestion.importers.supabase import _connection_options


class SupabaseImporterConnectionTests(unittest.TestCase):
    def test_production_requires_full_tls_verification(self) -> None:
        self.assertEqual(
            _connection_options("production"),
            {"sslmode": "verify-full"},
        )

    def test_non_production_preserves_default_connection_behavior(self) -> None:
        self.assertEqual(_connection_options("local"), {})


if __name__ == "__main__":
    unittest.main()
