from __future__ import annotations

import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

SCRIPT_PATH = Path(__file__).with_name("verify-answer-key.py")
SPEC = importlib.util.spec_from_file_location("verify_answer_key", SCRIPT_PATH)
assert SPEC is not None and SPEC.loader is not None
verify_answer_key = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(verify_answer_key)


class AnswerKeyVerificationTests(unittest.TestCase):
    def markdown(self, owner_review: str | None = None, quote: str | None = None):
        review = (
            f"\n\n**Owner review:** {owner_review}"
            if owner_review is not None
            else ""
        )
        shown_quote = quote or (
            "Photographs will be taken of any inmate that has been "
            "contaminated with OC during an immediate use of force."
        )
        return f"""# Draft

### Q5 - LOOKUP

**Question:** Do I need photographs if an inmate is contaminated with OC?

**Expected answer:** Yes, during an immediate use of force.

**Citation:** NCU 9.26.0, page 3

> \"{shown_quote}\"{review}
"""

    def corpus(self):
        return {
            "NCU9.26.0": {
                "3": (
                    "NUMBER: NCU 9.26.0. Photographs will be taken of any "
                    "inmate that has been contaminated with OC during an "
                    "immediate use of force."
                )
            }
        }

    def test_default_key_is_derived_from_the_repository_checkout(self):
        self.assertEqual(
            verify_answer_key.DEFAULT_KEY_PATH,
            SCRIPT_PATH.resolve().parents[1]
            / "docs"
            / "quality"
            / "answer-key-draft.md",
        )
        self.assertNotIn("C:\\Users\\", str(verify_answer_key.DEFAULT_KEY_PATH))

    def test_quote_and_page_match_does_not_approve_the_answer_claim(self):
        questions = verify_answer_key.parse_answer_key(self.markdown())

        summary = verify_answer_key.verify_answer_key(questions, self.corpus())

        self.assertEqual(summary.source_verified, ("Q5",))
        self.assertEqual(summary.owner_approved, ())
        self.assertEqual(summary.answer_review_pending, 1)
        self.assertEqual(
            summary.issues[0].reason,
            "ANSWER REQUIRES OWNER REVIEW",
        )

    def test_keep_marker_approves_only_after_source_verification(self):
        questions = verify_answer_key.parse_answer_key(
            self.markdown(owner_review="KEEP")
        )

        summary = verify_answer_key.verify_answer_key(questions, self.corpus())

        self.assertEqual(summary.source_verified, ("Q5",))
        self.assertEqual(summary.owner_approved, ("Q5",))
        self.assertEqual(summary.issues, ())

    def test_keep_marker_cannot_override_an_unsupported_quote(self):
        questions = verify_answer_key.parse_answer_key(
            self.markdown(
                owner_review="KEEP",
                quote="Planned and immediate photographs are always required.",
            )
        )

        summary = verify_answer_key.verify_answer_key(questions, self.corpus())

        self.assertEqual(summary.source_verified, ())
        self.assertEqual(summary.owner_approved, ())
        self.assertEqual(summary.issues[0].reason, "QUOTE NOT IN POLICY")

    def test_load_corpus_uses_the_supplied_private_root(self):
        with tempfile.TemporaryDirectory() as raw:
            root = Path(raw)
            bundle = root / "private" / "attempt-0001"
            bundle.mkdir(parents=True)
            (bundle / "chunks.json").write_text(
                json.dumps(
                    [
                        {
                            "printed_page_start": "3",
                            "content": (
                                "NUMBER: NCU 9.26.0. Photographs will be "
                                "taken during an immediate use of force."
                            ),
                        }
                    ]
                ),
                encoding="utf-8",
            )

            corpus = verify_answer_key.load_corpus(root)

            self.assertIn("NCU9.26.0", corpus)
            self.assertIn("3", corpus["NCU9.26.0"])

    def test_main_stays_red_until_answer_claims_are_owner_approved(self):
        with tempfile.TemporaryDirectory() as raw:
            root = Path(raw)
            key = root / "answer-key.md"
            key.write_text(self.markdown(), encoding="utf-8")
            bundle = root / "corpus" / "attempt-0001"
            bundle.mkdir(parents=True)
            (bundle / "chunks.json").write_text(
                json.dumps(
                    [
                        {
                            "printed_page_start": "3",
                            "content": self.corpus()["NCU9.26.0"]["3"],
                        }
                    ]
                ),
                encoding="utf-8",
            )

            self.assertEqual(
                verify_answer_key.main(
                    ["--corpus-root", str(root / "corpus"), "--key", str(key)]
                ),
                1,
            )


if __name__ == "__main__":
    unittest.main()
