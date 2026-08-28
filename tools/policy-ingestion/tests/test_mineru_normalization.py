from __future__ import annotations

import hashlib
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from guided_policy_ingestion.extractors.mineru import parse_mineru_content
from guided_policy_ingestion.models import SourceFile
from guided_policy_ingestion.normalization import normalize_extraction


class MinerUNormalizationTests(unittest.TestCase):
    def test_parses_v2_pages_headings_labels_and_tables(self) -> None:
        fixture = Path(__file__).parent / "fixtures" / "fictional_policy_content_list_v2.json"
        extraction = parse_mineru_content(fixture, "3.4.5")
        source = SourceFile(
            path=fixture,
            collection="BMU Post Orders",
            relative_path="BMU Post Orders/fictional.pdf",
            filename="fictional.pdf",
            sha256=hashlib.sha256(fixture.read_bytes()).hexdigest(),
            media_type="application/pdf",
            size_bytes=fixture.stat().st_size,
        )
        pages = normalize_extraction(source, extraction)
        self.assertEqual(len(pages), 2)
        self.assertEqual(pages[0].printed_page_label, "A-1")
        self.assertEqual(pages[1].printed_page_label, "A-2")
        self.assertEqual(pages[0].section_path, "Fictional Training Procedure")
        self.assertEqual(pages[1].section_path, "Fictional Training Procedure > Review Steps")
        self.assertIn("[TABLE]", pages[1].normalized_text)
        self.assertEqual(pages[1].extraction_mode, "mixed")
        self.assertEqual(pages[1].ocr_confidence, 0.91)
        self.assertEqual(len(pages[1].layout_metadata_sha256 or ""), 64)
        self.assertIn("pdf_extraction_mode_inferred", pages[1].warning_codes)


if __name__ == "__main__":
    unittest.main()
