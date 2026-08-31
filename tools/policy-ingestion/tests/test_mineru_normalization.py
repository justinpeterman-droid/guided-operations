from __future__ import annotations

import hashlib
import json
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
        fixture = (
            Path(__file__).parent
            / "fixtures"
            / "fictional_policy_content_list_v2.json"
        )
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
        self.assertEqual(extraction.page_count, 2)
        self.assertEqual(extraction.observed_page_count, 2)
        self.assertEqual(len(pages), 2)
        self.assertEqual(pages[0].printed_page_label, "A-1")
        self.assertEqual(pages[1].printed_page_label, "A-2")
        self.assertEqual(pages[0].section_path, "Fictional Training Procedure")
        self.assertEqual(
            pages[1].section_path,
            "Fictional Training Procedure > Review Steps",
        )
        self.assertIn("[TABLE]", pages[1].normalized_text)
        self.assertEqual(pages[1].extraction_mode, "mixed")
        self.assertEqual(pages[1].ocr_confidence, 0.91)
        self.assertEqual(len(pages[1].layout_metadata_sha256 or ""), 64)
        self.assertIn(
            "pdf_extraction_mode_inferred", pages[1].warning_codes
        )

    def test_parses_mineru_nested_page_arrays_and_content_objects(self) -> None:
        payload = [
            [
                {
                    "type": "title",
                    "content": {
                        "title_content": [
                            {"type": "text", "content": "Fictional Heading"}
                        ],
                        "level": 1,
                    },
                    "bbox": [0, 0, 10, 10],
                },
                {
                    "type": "paragraph",
                    "content": {
                        "paragraph_content": [
                            {
                                "type": "text",
                                "content": "Fictional first page content.",
                            }
                        ]
                    },
                    "bbox": [0, 10, 10, 20],
                },
            ],
            [
                {
                    "type": "table",
                    "content": {
                        "html": (
                            "<table><tr><td>Fictional table value"
                            "</td></tr></table>"
                        ),
                        "table_caption": [],
                        "table_footnote": [],
                    },
                    "bbox": [0, 0, 10, 10],
                }
            ],
        ]
        with tempfile.TemporaryDirectory() as directory:
            fixture = Path(directory) / "fictional_nested_content_list_v2.json"
            fixture.write_text(json.dumps(payload), encoding="utf-8")
            extraction = parse_mineru_content(fixture, "3.4.5")
            source = SourceFile(
                path=fixture,
                collection="BMU policies",
                relative_path="BMU policies/fictional.pdf",
                filename="fictional.pdf",
                sha256=hashlib.sha256(fixture.read_bytes()).hexdigest(),
                media_type="application/pdf",
                size_bytes=fixture.stat().st_size,
            )
            pages = normalize_extraction(source, extraction)

        self.assertEqual(extraction.page_count, 2)
        self.assertEqual(extraction.observed_page_count, 2)
        self.assertEqual(len(pages), 2)
        self.assertEqual(pages[0].heading, "Fictional Heading")
        self.assertIn(
            "Fictional first page content.", pages[0].normalized_text
        )
        self.assertIn("[TABLE]", pages[1].normalized_text)
        self.assertIn("Fictional table value", pages[1].normalized_text)

    def test_sparse_page_indexes_preserve_declared_and_observed_counts(self):
        payload = [
            {"page_idx": 0, "type": "text", "text": "First page"},
            {"page_idx": 2, "type": "text", "text": "Third page"},
        ]
        with tempfile.TemporaryDirectory() as directory:
            fixture = Path(directory) / "sparse_content_list.json"
            fixture.write_text(json.dumps(payload), encoding="utf-8")
            extraction = parse_mineru_content(fixture, "3.4.5")

        self.assertEqual(extraction.page_count, 3)
        self.assertEqual(extraction.observed_page_count, 2)


if __name__ == "__main__":
    unittest.main()
