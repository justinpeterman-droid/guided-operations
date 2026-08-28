from __future__ import annotations

import hashlib
import sys
import tempfile
import unittest
from dataclasses import replace
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from guided_policy_ingestion.chunking import chunk_pages
from guided_policy_ingestion.config import ChunkingConfig
from guided_policy_ingestion.models import NormalizedPage, SourceFile
from guided_policy_ingestion.validation import validate_document


def page(index: int, text: str, section: str) -> NormalizedPage:
    return NormalizedPage(
        source_page_index=index,
        printed_page_label=f"P-{index}",
        normalized_text=text,
        normalized_text_sha256=hashlib.sha256(text.encode()).hexdigest(),
        extraction_mode="native",
        heading=section,
        section_path=section,
    )


class ChunkingValidationTests(unittest.TestCase):
    def test_chunking_is_deterministic_bounded_and_preserves_provenance(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "fictional.docx"
            path.write_bytes(b"fictional source")
            source = SourceFile(
                path=path,
                collection="SD",
                relative_path="SD/fictional.docx",
                filename=path.name,
                sha256=hashlib.sha256(path.read_bytes()).hexdigest(),
                media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                size_bytes=path.stat().st_size,
            )
            pages = tuple(page(i, (f"Fictional page {i}. " * 80), f"Section {i}") for i in range(1, 4))
            config = ChunkingConfig(target_characters=500, maximum_characters=800, maximum_pages=2)
            first = chunk_pages(source, pages, config, "a" * 64)
            second = chunk_pages(source, pages, config, "a" * 64)
            self.assertEqual(first, second)
            self.assertTrue(first)
            self.assertTrue(all(chunk.page_end - chunk.page_start + 1 <= 2 for chunk in first))
            self.assertTrue(all(chunk.collection == "SD" for chunk in first))
            self.assertTrue(all(chunk.source_sha256 == source.sha256 for chunk in first))
            self.assertTrue(all(chunk.section_path for chunk in first))
            result = validate_document(source, pages, first, config, expected_page_count=3)
            self.assertEqual(result.status, "awaiting_review")
            self.assertFalse(result.errors)

    def test_page_continuity_failure_is_not_silently_ready(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "fictional.pdf"
            path.write_bytes(b"fictional")
            source = SourceFile(path, "BMU policies", "BMU policies/fictional.pdf", path.name, hashlib.sha256(path.read_bytes()).hexdigest(), "application/pdf", path.stat().st_size)
            pages = (page(1, "Fictional first page text long enough for review.", "One"), page(3, "Fictional third page text long enough for review.", "Three"))
            result = validate_document(source, pages, (), ChunkingConfig(), expected_page_count=2)
            self.assertEqual(result.status, "failed")
            self.assertIn("page_numbers_not_continuous", result.errors)

    def test_low_quality_extraction_requires_review(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "fictional.png"
            path.write_bytes(b"fictional")
            source = SourceFile(path, "BMU policies", "BMU policies/fictional.png", path.name, hashlib.sha256(path.read_bytes()).hexdigest(), "image/png", path.stat().st_size)
            low_quality = replace(page(1, "tiny", "One"), quality_flags=("suspiciously_short_page",))
            chunks = chunk_pages(source, (low_quality,), ChunkingConfig(), "b" * 64)
            result = validate_document(source, (low_quality,), chunks, ChunkingConfig(), expected_page_count=1)
            self.assertEqual(result.status, "awaiting_review")
            self.assertIn("low_quality_extraction_requires_review", result.warnings)


if __name__ == "__main__":
    unittest.main()
