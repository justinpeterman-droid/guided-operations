from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from guided_policy_ingestion.models import ExtractionResult, RawBlock, SourceFile
from guided_policy_ingestion.normalization import normalize_extraction


class NormalizationPageBoundsTests(unittest.TestCase):
    def source(self) -> SourceFile:
        return SourceFile(
            path=Path("fictional.pdf"),
            collection="BMU policies",
            relative_path="BMU policies/fictional.pdf",
            filename="fictional.pdf",
            sha256="a" * 64,
            media_type="application/pdf",
            size_bytes=1024,
        )

    def extraction_with_page_index(self, page_index: int) -> ExtractionResult:
        return ExtractionResult(
            blocks=(
                RawBlock(
                    page_index=page_index,
                    kind="text",
                    text="Fictional extracted policy text.",
                ),
            ),
            page_count=2,
            observed_page_count=2,
            extraction_tool="fictional",
            extraction_version="fictional-v1",
            extraction_model_version=None,
        )

    def test_rejects_blocks_outside_the_observed_page_range(self) -> None:
        for page_index in (-1, 2):
            with self.subTest(page_index=page_index):
                with self.assertRaisesRegex(
                    ValueError,
                    "outside the observed page range",
                ):
                    normalize_extraction(
                        self.source(),
                        self.extraction_with_page_index(page_index),
                    )


if __name__ == "__main__":
    unittest.main()
