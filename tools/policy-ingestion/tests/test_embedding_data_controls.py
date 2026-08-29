from __future__ import annotations

import unittest

from guided_policy_ingestion.embeddings.data_controls import (
    require_approved_openai_data_controls,
)


class EmbeddingDataControlsTests(unittest.TestCase):
    def test_accepts_approved_retention_with_data_sharing_disabled(self) -> None:
        require_approved_openai_data_controls(
            {
                "OPENAI_DATA_CONTROLS_APPROVAL_REF": "fictional-owner-approval",
                "OPENAI_DATA_RETENTION_MODE": "zero_data_retention",
                "OPENAI_API_DATA_SHARING_ENABLED": "false",
            }
        )

    def test_rejects_default_none_or_enabled_sharing(self) -> None:
        for mode in ("organization_default", "none", ""):
            with self.subTest(mode=mode), self.assertRaisesRegex(
                ValueError, "Approved OpenAI data controls"
            ):
                require_approved_openai_data_controls(
                    {
                        "OPENAI_DATA_CONTROLS_APPROVAL_REF": "fictional-owner-approval",
                        "OPENAI_DATA_RETENTION_MODE": mode,
                        "OPENAI_API_DATA_SHARING_ENABLED": "false",
                    }
                )

        with self.assertRaisesRegex(ValueError, "Approved OpenAI data controls"):
            require_approved_openai_data_controls(
                {
                    "OPENAI_DATA_CONTROLS_APPROVAL_REF": "fictional-owner-approval",
                    "OPENAI_DATA_RETENTION_MODE": "modified_abuse_monitoring",
                    "OPENAI_API_DATA_SHARING_ENABLED": "true",
                }
            )

        with self.assertRaisesRegex(ValueError, "Approved OpenAI data controls"):
            require_approved_openai_data_controls(
                {
                    "OPENAI_DATA_CONTROLS_APPROVAL_REF": "contains private notes",
                    "OPENAI_DATA_RETENTION_MODE": "zero_data_retention",
                    "OPENAI_API_DATA_SHARING_ENABLED": "false",
                }
            )


if __name__ == "__main__":
    unittest.main()
