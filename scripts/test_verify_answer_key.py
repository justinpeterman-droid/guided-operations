from __future__ import annotations

import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPT_PATH = Path(__file__).with_name("verify-answer-key.py")
SPEC = importlib.util.spec_from_file_location("verify_answer_key", SCRIPT_PATH)
assert SPEC is not None and SPEC.loader is not None
verify_answer_key = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = verify_answer_key
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

    def test_dashed_and_spaced_policy_numbers_share_one_canonical_key(self):
        self.assertEqual(
            verify_answer_key.canonical_policy_number("NCU-9.26.0"),
            verify_answer_key.canonical_policy_number("NCU 9.26.0"),
        )
        self.assertEqual(
            verify_answer_key.canonical_policy_number("NCU-9.26.0"),
            "NCU9.26.0",
        )

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

    def test_citation_page_labels_are_canonicalized(self):
        questions = verify_answer_key.parse_answer_key(
            self.markdown(owner_review="KEEP").replace("page 3", "page 003")
        )

        summary = verify_answer_key.verify_answer_key(questions, self.corpus())

        self.assertEqual(summary.source_verified, ("Q5",))
        self.assertEqual(summary.owner_approved, ("Q5",))
        self.assertEqual(summary.issues, ())

    def test_every_quote_fragment_must_appear_on_a_cited_page(self):
        questions = verify_answer_key.parse_answer_key(
            self.markdown(
                owner_review="KEEP",
                quote=(
                    "Photographs will be taken during an immediate use of force"
                    "...A separate incident narrative must be reviewed by the "
                    "shift supervisor"
                ),
            )
        )
        corpus = {
            "NCU9.26.0": {
                "3": "Photographs will be taken during an immediate use of force.",
                "4": (
                    "A separate incident narrative must be reviewed by the "
                    "shift supervisor."
                ),
            }
        }

        summary = verify_answer_key.verify_answer_key(questions, corpus)

        self.assertEqual(summary.source_verified, ())
        self.assertEqual(summary.owner_approved, ())
        self.assertEqual(summary.issues[0].reason, "WRONG PAGE")

    def test_load_corpus_normalizes_numeric_pages_and_skips_page_less_chunks(self):
        with tempfile.TemporaryDirectory() as raw:
            root = Path(raw)
            bundle = root / "private" / "attempt-0001"
            bundle.mkdir(parents=True)
            (bundle / "chunks.json").write_text(
                json.dumps(
                    [
                        {
                            "content": "NUMBER: NCU 9.26.0. Page-less metadata.",
                        },
                        {
                            "printed_page_start": 3,
                            "content": (
                                "NUMBER: NCU 9.26.0. Photographs will be "
                                "taken during an immediate use of force."
                            ),
                        },
                        {
                            "printed_page_start": "003",
                            "content": "Additional page three text.",
                        },
                    ]
                ),
                encoding="utf-8",
            )

            corpus = verify_answer_key.load_corpus(root)

            self.assertIn("NCU9.26.0", corpus)
            self.assertIn("3", corpus["NCU9.26.0"])
            self.assertNotIn("None", corpus["NCU9.26.0"])
            self.assertNotIn("003", corpus["NCU9.26.0"])
            self.assertNotIn(
                "Page-less metadata.", corpus["NCU9.26.0"]["3"]
            )
            self.assertIn("Additional page three text", corpus["NCU9.26.0"]["3"])

    def test_load_corpus_skips_unicode_digits_rejected_by_int(self):
        with tempfile.TemporaryDirectory() as raw:
            root = Path(raw)
            bundle = root / "private" / "attempt-0001"
            bundle.mkdir(parents=True)
            (bundle / "chunks.json").write_text(
                json.dumps(
                    [
                        {
                            "printed_page_start": 3,
                            "content": "NUMBER: NCU 9.26.0. Numbered page.",
                        },
                        {
                            "printed_page_start": "²",
                            "content": "Malformed Unicode page.",
                        },
                    ]
                ),
                encoding="utf-8",
            )

            corpus = verify_answer_key.load_corpus(root)

            self.assertEqual(set(corpus["NCU9.26.0"]), {"3"})
            self.assertNotIn(
                "Malformed Unicode page.", corpus["NCU9.26.0"]["3"]
            )

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
                            "printed_page_start": 3,
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

    def test_main_rejects_an_answer_key_without_questions(self):
        with tempfile.TemporaryDirectory() as raw:
            root = Path(raw)
            key = root / "answer-key.md"
            key.write_text("# Empty answer key\n", encoding="utf-8")
            corpus_root = root / "corpus"
            corpus_root.mkdir()

            self.assertEqual(
                verify_answer_key.main(
                    ["--corpus-root", str(corpus_root), "--key", str(key)]
                ),
                2,
            )

    def test_main_rejects_a_question_heading_without_an_identifier(self):
        with tempfile.TemporaryDirectory() as raw:
            root = Path(raw)
            key = root / "answer-key.md"
            key.write_text(
                """# Draft

### 

**Question:** Malformed question without an identifier.

**Expected answer:** It must not pass verification.

**Citation:** NCU 9.26.0, page 3

> "Photographs will be taken of any inmate that has been contaminated with OC during an immediate use of force."

**Owner review:** KEEP
""",
                encoding="utf-8",
            )
            corpus_root = root / "corpus"
            corpus_root.mkdir()

            self.assertEqual(
                verify_answer_key.main(
                    ["--corpus-root", str(corpus_root), "--key", str(key)]
                ),
                2,
            )


if __name__ == "__main__":
    unittest.main()
