import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from guided_policy_ingestion.registration import (
    PolicySource,
    RegistrationErrorSafe,
    RightsAttestation,
    load_manifests,
    slugify,
    stable_keys_for,
    with_byte_sizes,
)

_STABLE_KEY_ALPHABET = set("abcdefghijklmnopqrstuvwxyz0123456789_-")


def _manifest(root: Path, slug: str, sha: str, filename: str, collection: str, pages: int = 4):
    directory = root / slug / sha / "config" / "attempt-0001"
    directory.mkdir(parents=True, exist_ok=True)
    (directory / "manifest.json").write_text(
        json.dumps(
            {
                "collection": collection,
                "media_type": "application/pdf",
                "page_count": pages,
                "source_filename": filename,
                "source_sha256": sha,
            }
        ),
        encoding="utf-8",
    )


class SlugTests(unittest.TestCase):
    def test_produces_only_characters_the_database_accepts(self):
        messy = "BMU 1.03.0, Roles of Consultants & Agents (rev. 2).pdf"
        slug = slugify(Path(messy).stem)
        self.assertTrue(set(slug) <= _STABLE_KEY_ALPHABET)
        self.assertFalse(slug.startswith("-"))
        self.assertFalse(slug.endswith("-"))

    def test_strips_accents_rather_than_dropping_the_word(self):
        self.assertEqual(slugify("Régime Cañón"), "regime-canon")

    def test_bounds_length_for_the_stable_key_check(self):
        self.assertLessEqual(len(slugify("a" * 400)), 128)


class StableKeyTests(unittest.TestCase):
    def test_readable_keys_stay_readable_when_nothing_collides(self):
        sources = (
            PolicySource("a" * 64, "SD", "SD 01-02 Grievances.pdf", "application/pdf", 3),
            PolicySource("b" * 64, "SD", "SD 03-04 Visitation.pdf", "application/pdf", 3),
        )
        keys = stable_keys_for(sources)
        self.assertEqual(keys["a" * 64], "sd-01-02-grievances")
        self.assertEqual(keys["b" * 64], "sd-03-04-visitation")

    def test_only_the_colliding_keys_take_a_hash_suffix(self):
        sources = (
            PolicySource("a" * 64, "SD", "Count Sheet.pdf", "application/pdf", 1),
            PolicySource("b" * 64, "BMU policies", "Count  Sheet!.pdf", "application/pdf", 1),
            PolicySource("c" * 64, "SD", "Unique Title.pdf", "application/pdf", 1),
        )
        keys = stable_keys_for(sources)
        self.assertNotEqual(keys["a" * 64], keys["b" * 64])
        self.assertTrue(keys["a" * 64].endswith("aaaaaaaa"))
        self.assertEqual(keys["c" * 64], "unique-title")

    def test_a_filename_with_no_usable_characters_still_gets_a_key(self):
        sources = (PolicySource("d" * 64, "SD", "!!!.pdf", "application/pdf", 1),)
        key = stable_keys_for(sources)["d" * 64]
        self.assertTrue(set(key) <= _STABLE_KEY_ALPHABET)
        self.assertGreaterEqual(len(key), 2)


class StoragePathTests(unittest.TestCase):
    def test_path_is_content_addressed_and_never_leaks_the_filename(self):
        source = PolicySource(
            "e" * 64, "BMU Post Orders", "Tower 3 Post Order.pdf", "application/pdf", 6
        )
        self.assertEqual(source.storage_path, f"bmu-post-orders/{'e' * 64}.pdf")
        self.assertNotIn("Tower", source.storage_path)


class ManifestLoadingTests(unittest.TestCase):
    def test_reads_every_collection_and_sorts_deterministically(self):
        with tempfile.TemporaryDirectory() as raw:
            root = Path(raw)
            _manifest(root, "sd", "b" * 64, "SD 01.pdf", "SD")
            _manifest(root, "bmu-policies", "a" * 64, "BMU 1.0.pdf", "BMU policies")
            sources = load_manifests(root)
            self.assertEqual([s.source_sha256 for s in sources], ["a" * 64, "b" * 64])

    def test_one_collection_can_be_registered_alone(self):
        with tempfile.TemporaryDirectory() as raw:
            root = Path(raw)
            _manifest(root, "sd", "b" * 64, "SD 01.pdf", "SD")
            _manifest(root, "bmu-policies", "a" * 64, "BMU 1.0.pdf", "BMU policies")
            sources = load_manifests(root, "SD")
            self.assertEqual(len(sources), 1)
            self.assertEqual(sources[0].collection, "SD")

    def test_a_second_attempt_does_not_register_the_source_twice(self):
        with tempfile.TemporaryDirectory() as raw:
            root = Path(raw)
            sha = "c" * 64
            for attempt in ("attempt-0001", "attempt-0002"):
                directory = root / "sd" / sha / "config" / attempt
                directory.mkdir(parents=True, exist_ok=True)
                (directory / "manifest.json").write_text(
                    json.dumps(
                        {
                            "collection": "SD",
                            "media_type": "application/pdf",
                            "page_count": 2,
                            "source_filename": "SD 09.pdf",
                            "source_sha256": sha,
                        }
                    ),
                    encoding="utf-8",
                )
            self.assertEqual(len(load_manifests(root)), 1)

    def test_a_manifest_without_a_usable_hash_is_refused(self):
        with tempfile.TemporaryDirectory() as raw:
            root = Path(raw)
            directory = root / "sd" / "short" / "config" / "attempt-0001"
            directory.mkdir(parents=True, exist_ok=True)
            (directory / "manifest.json").write_text(
                json.dumps({"collection": "SD", "source_sha256": "abc"}), encoding="utf-8"
            )
            with self.assertRaises(RegistrationErrorSafe):
                load_manifests(root)

    def test_a_missing_work_directory_is_refused(self):
        with self.assertRaises(RegistrationErrorSafe):
            load_manifests(Path("does-not-exist-anywhere"))


class ByteSizeTests(unittest.TestCase):
    def test_sizes_are_filled_from_the_original_files(self):
        with tempfile.TemporaryDirectory() as raw:
            root = Path(raw)
            (root / "SD").mkdir()
            (root / "SD" / "SD 01.pdf").write_bytes(b"12345")
            sources = (PolicySource("a" * 64, "SD", "SD 01.pdf", "application/pdf", 1),)
            self.assertEqual(with_byte_sizes(sources, root)[0].byte_size, 5)

    def test_a_missing_source_folder_degrades_to_null_rather_than_failing(self):
        sources = (PolicySource("a" * 64, "SD", "SD 01.pdf", "application/pdf", 1),)
        self.assertIsNone(with_byte_sizes(sources, Path("nowhere"))[0].byte_size)
        self.assertIsNone(with_byte_sizes(sources, None)[0].byte_size)


class RightsAttestationTests(unittest.TestCase):
    def test_pending_rights_cannot_allow_external_ai(self):
        with self.assertRaises(RegistrationErrorSafe):
            RightsAttestation(
                reviewer_staff_member_id="11111111-1111-4111-8111-111111111111",
                evidence_ref="O-021",
                rights_status="pending",
                external_ai_allowed=True,
            )

    def test_an_approved_status_requires_evidence(self):
        with self.assertRaises(RegistrationErrorSafe):
            RightsAttestation(
                reviewer_staff_member_id="11111111-1111-4111-8111-111111111111",
                evidence_ref="   ",
            )

    def test_an_unknown_status_is_refused(self):
        with self.assertRaises(RegistrationErrorSafe):
            RightsAttestation(
                reviewer_staff_member_id="11111111-1111-4111-8111-111111111111",
                evidence_ref="O-021",
                rights_status="approved_everything",
            )

    def test_a_pending_registration_is_allowed_when_ai_is_not(self):
        attestation = RightsAttestation(
            reviewer_staff_member_id="11111111-1111-4111-8111-111111111111",
            evidence_ref="",
            rights_status="pending",
            external_ai_allowed=False,
        )
        self.assertFalse(attestation.external_ai_allowed)


if __name__ == "__main__":
    unittest.main()
