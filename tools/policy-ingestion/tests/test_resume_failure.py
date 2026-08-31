from __future__ import annotations

import json
import sys
import tempfile
import unittest
from dataclasses import replace
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from guided_policy_ingestion.checkpoints import CheckpointStore
from guided_policy_ingestion.config import ChunkingConfig, ExtractionConfig
from guided_policy_ingestion.extractors.base import ExtractionError
from guided_policy_ingestion.extractors.mineru import parse_mineru_content
from guided_policy_ingestion.pipeline import IngestionPipeline


class FictionalProvider:
    name = "fictional"

    def __init__(self, fixture: Path):
        self.fixture = fixture
        self.calls = 0

    def extract(self, source, output_dir):
        self.calls += 1
        return parse_mineru_content(self.fixture, "fictional-v1")


class MismatchedPageCountProvider(FictionalProvider):
    def extract(self, source, output_dir):
        extraction = super().extract(source, output_dir)
        return replace(extraction, page_count=extraction.page_count + 1)


class FailingProvider:
    name = "failing"

    def extract(self, source, output_dir):
        raise ExtractionError(
            "fictional_extraction_failure", "Fictional extraction failed"
        )


def make_root(base: Path) -> Path:
    root = base / "policies"
    for collection in ("BMU policies", "BMU Post Orders", "SD"):
        (root / collection).mkdir(parents=True)
    (root / "BMU policies" / "fictional.pdf").write_bytes(
        b"fictional source"
    )
    return root


class ResumeFailureTests(unittest.TestCase):
    def fixture(self) -> Path:
        return (
            Path(__file__).parent
            / "fixtures"
            / "fictional_policy_content_list_v2.json"
        )

    def test_successful_source_is_skipped_with_same_configuration(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            base = Path(temporary)
            provider = FictionalProvider(self.fixture())
            pipeline = IngestionPipeline(
                provider,
                CheckpointStore(base / "work"),
                ExtractionConfig(),
                ChunkingConfig(),
            )
            first = pipeline.run(make_root(base), resume=True)
            second = pipeline.run(base / "policies", resume=True)
            self.assertEqual(first.awaiting_review, 1)
            self.assertEqual(second.skipped_unchanged, 1)
            self.assertEqual(provider.calls, 1)

    def test_failed_extraction_is_checkpointed_and_never_succeeds(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            base = Path(temporary)
            store = CheckpointStore(base / "work")
            pipeline = IngestionPipeline(
                FailingProvider(),
                store,
                ExtractionConfig(),
                ChunkingConfig(),
            )
            summary = pipeline.run(make_root(base), resume=True)
            self.assertEqual(summary.failed, 1)
            state_files = list((base / "work").rglob("state.json"))
            self.assertEqual(len(state_files), 1)
            self.assertIn(
                '"status": "failed"',
                state_files[0].read_text(encoding="utf-8"),
            )
            self.assertIn(
                '"failure_code": "fictional_extraction_failure"',
                state_files[0].read_text(encoding="utf-8"),
            )

    def test_force_creates_a_new_attempt(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            base = Path(temporary)
            provider = FictionalProvider(self.fixture())
            pipeline = IngestionPipeline(
                provider,
                CheckpointStore(base / "work"),
                ExtractionConfig(),
                ChunkingConfig(),
            )
            pipeline.run(make_root(base), resume=True)
            forced = pipeline.run(base / "policies", force=True)
            self.assertEqual(forced.awaiting_review, 1)
            self.assertEqual(provider.calls, 2)
            attempts = sorted((base / "work").rglob("attempt-*"))
            self.assertEqual(
                [attempt.name for attempt in attempts],
                ["attempt-0001", "attempt-0002"],
            )

    def test_import_only_reuses_original_extractor_page_count(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            base = Path(temporary)
            provider = MismatchedPageCountProvider(self.fixture())
            pipeline = IngestionPipeline(
                provider,
                CheckpointStore(base / "work"),
                ExtractionConfig(),
                ChunkingConfig(),
            )
            root = make_root(base)

            first = pipeline.run(root, resume=True)
            self.assertEqual(first.failed, 1)
            attempt = next((base / "work").rglob("attempt-*"))
            manifest = json.loads(
                (attempt / "manifest.json").read_text(encoding="utf-8")
            )
            pages = json.loads(
                (attempt / "pages.json").read_text(encoding="utf-8")
            )
            self.assertEqual(
                manifest["extracted_page_count"], len(pages) + 1
            )
            self.assertEqual(manifest["observed_page_count"], len(pages))

            retried = pipeline.run(root, resume=True, import_only=True)

            self.assertEqual(retried.failed, 1)
            self.assertEqual(retried.awaiting_review, 0)
            self.assertEqual(provider.calls, 1)
            state = json.loads(
                (attempt / "state.json").read_text(encoding="utf-8")
            )
            self.assertEqual(
                state["failure_code"],
                "extracted_page_count_mismatch",
            )

    def test_import_only_rejects_legacy_manifest_without_page_evidence(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            base = Path(temporary)
            provider = FictionalProvider(self.fixture())
            pipeline = IngestionPipeline(
                provider,
                CheckpointStore(base / "work"),
                ExtractionConfig(),
                ChunkingConfig(),
            )
            root = make_root(base)
            first = pipeline.run(root, resume=True)
            self.assertEqual(first.awaiting_review, 1)

            attempt = next((base / "work").rglob("attempt-*"))
            manifest_path = attempt / "manifest.json"
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            manifest.pop("extracted_page_count")
            manifest_path.write_text(
                json.dumps(manifest),
                encoding="utf-8",
            )

            retried = pipeline.run(root, resume=True, import_only=True)

            self.assertEqual(retried.failed, 1)
            self.assertEqual(retried.awaiting_review, 0)
            self.assertEqual(provider.calls, 1)
            state = json.loads(
                (attempt / "state.json").read_text(encoding="utf-8")
            )
            self.assertEqual(
                state["failure_code"],
                "missing_extracted_page_count_evidence",
            )

    def test_import_only_rejects_manifest_without_observed_page_evidence(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            base = Path(temporary)
            provider = FictionalProvider(self.fixture())
            pipeline = IngestionPipeline(
                provider,
                CheckpointStore(base / "work"),
                ExtractionConfig(),
                ChunkingConfig(),
            )
            root = make_root(base)
            first = pipeline.run(root, resume=True)
            self.assertEqual(first.awaiting_review, 1)

            attempt = next((base / "work").rglob("attempt-*"))
            manifest_path = attempt / "manifest.json"
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            manifest.pop("observed_page_count")
            manifest_path.write_text(
                json.dumps(manifest),
                encoding="utf-8",
            )

            retried = pipeline.run(root, resume=True, import_only=True)

            self.assertEqual(retried.failed, 1)
            self.assertEqual(retried.awaiting_review, 0)
            self.assertEqual(provider.calls, 1)
            state = json.loads(
                (attempt / "state.json").read_text(encoding="utf-8")
            )
            self.assertEqual(
                state["failure_code"],
                "missing_observed_page_count_evidence",
            )


if __name__ == "__main__":
    unittest.main()
