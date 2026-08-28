from __future__ import annotations

import hashlib
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from guided_policy_ingestion.collections import CANONICAL_COLLECTIONS
from guided_policy_ingestion.discovery import discover_sources, sha256_file


class DiscoveryTests(unittest.TestCase):
    def test_discovers_supported_files_and_preserves_collection(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            for collection in CANONICAL_COLLECTIONS:
                (root / collection / "nested").mkdir(parents=True)
            (root / "BMU policies" / "alpha.pdf").write_bytes(b"fictional pdf")
            (root / "BMU Post Orders" / "nested" / "bravo.docx").write_bytes(b"fictional docx")
            (root / "SD" / "scan.tiff").write_bytes(b"fictional scan")
            (root / "SD" / "ignored.txt").write_text("not supported", encoding="utf-8")
            sources = discover_sources(root)
            self.assertEqual([source.collection for source in sources], list(CANONICAL_COLLECTIONS))
            self.assertEqual({source.media_type for source in sources}, {
                "application/pdf",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "image/tiff",
            })
            self.assertTrue(all(source.relative_path.startswith(source.collection) for source in sources))

    def test_sha256_identity_is_streamed_and_exact(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "fictional.pdf"
            payload = b"fictional policy identity"
            path.write_bytes(payload)
            self.assertEqual(sha256_file(path), hashlib.sha256(payload).hexdigest())

    def test_collection_filter_uses_exact_canonical_value(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            for collection in CANONICAL_COLLECTIONS:
                (root / collection).mkdir()
                (root / collection / "sample.pdf").write_bytes(collection.encode())
            sources = discover_sources(root, collection="SD")
            self.assertEqual(len(sources), 1)
            self.assertEqual(sources[0].collection, "SD")


if __name__ == "__main__":
    unittest.main()
