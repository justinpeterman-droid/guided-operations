from __future__ import annotations

import sys
import tempfile
import unittest
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


class FailingProvider:
    name = "failing"

    def extract(self, source, output_dir):
        raise ExtractionError("fictional_extraction_failure", "Fictional extraction failed")


def make_root(base: Path) -> Path:
    root = base / "policies"
    for collection in ("BMU policies", "BMU Post Orders", "SD"):
        (root / collection).mkdir(parents=True)
    (root / "BMU policies" / "fictional.pdf").write_bytes(b"fictional source")
    return root


class ResumeFailureTests(unittest.TestCase):
    def test_successful_source_is_skipped_with_same_configuration(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            base = Path(temporary)
            provider = FictionalProvider(Path(__file__).parent / "fixtures" / "fictional_policy_content_list_v2.json")
            pipeline = IngestionPipeline(provider, CheckpointStore(base / "work"), ExtractionConfig(), ChunkingConfig())
            first = pipeline.run(make_root(base), resume=True)
            second = pipeline.run(base / "policies", resume=True)
            self.assertEqual(first.awaiting_review, 1)
            self.assertEqual(second.skipped_unchanged, 1)
            self.assertEqual(provider.calls, 1)

    def test_failed_extraction_is_checkpointed_and_never_succeeds(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            base = Path(temporary)
            store = CheckpointStore(base / "work")
            pipeline = IngestionPipeline(FailingProvider(), store, ExtractionConfig(), ChunkingConfig())
            summary = pipeline.run(make_root(base), resume=True)
            self.assertEqual(summary.failed, 1)
            state_files = list((base / "work").rglob("state.json"))
            self.assertEqual(len(state_files), 1)
            self.assertIn('"status": "failed"', state_files[0].read_text(encoding="utf-8"))
            self.assertIn('"failure_code": "fictional_extraction_failure"', state_files[0].read_text(encoding="utf-8"))

    def test_force_creates_a_new_attempt(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            base = Path(temporary)
            provider = FictionalProvider(Path(__file__).parent / "fixtures" / "fictional_policy_content_list_v2.json")
            pipeline = IngestionPipeline(provider, CheckpointStore(base / "work"), ExtractionConfig(), ChunkingConfig())
            pipeline.run(make_root(base), resume=True)
            forced = pipeline.run(base / "policies", force=True)
            self.assertEqual(forced.awaiting_review, 1)
            self.assertEqual(provider.calls, 2)
            attempts = sorted((base / "work").rglob("attempt-*"))
            self.assertEqual([attempt.name for attempt in attempts], ["attempt-0001", "attempt-0002"])


if __name__ == "__main__":
    unittest.main()
