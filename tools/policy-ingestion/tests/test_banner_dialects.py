import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from guided_policy_ingestion.extractors.mineru import _apply_banner_page_labels
from guided_policy_ingestion.models import RawBlock


def _doc(banner_text, second_banner_text, page_count=3):
    """Independent banner blocks on two pages, plain body text on the rest."""
    blocks = [
        RawBlock(
            page_index=0,
            kind="table",
            text="",
            table_html="<table><tr><td>%s</td></tr></table>" % banner_text,
        )
    ]
    for i in range(1, page_count):
        blocks.append(
            RawBlock(
                page_index=i,
                kind="table" if i == 1 else "text",
                text="" if i == 1 else "body text page %d" % i,
                table_html=(
                    "<table><tr><td>%s</td></tr></table>" % second_banner_text
                    if i == 1
                    else None
                ),
            )
        )
    return blocks


def _labels(blocks):
    found = {}
    for b in blocks:
        if b.printed_page_label and b.page_index not in found:
            found[b.page_index] = b.printed_page_label
    return found


class BannerDialectTests(unittest.TestCase):
    """Each collection states the printed page differently. All must work."""

    def test_unit_policy_dialect(self):
        blocks = _doc("PAGE NUMBER 1 OF 3", "PAGE NUMBER 2 OF 3")
        _apply_banner_page_labels(blocks, 3, [])
        self.assertEqual(_labels(blocks), {0: "1", 1: "2", 2: "3"})

    def test_post_order_dialect(self):
        blocks = _doc(
            "Effective Date: 2/27/2026    Page 1 of 3",
            "Effective Date: 2/27/2026    Page 2 of 3",
        )
        _apply_banner_page_labels(blocks, 3, [])
        self.assertEqual(_labels(blocks), {0: "1", 1: "2", 2: "3"})

    def test_secretarial_directive_dialect(self):
        blocks = _doc("PAGE: 1 of 3", "PAGE: 2 of 3")
        _apply_banner_page_labels(blocks, 3, [])
        self.assertEqual(_labels(blocks), {0: "1", 1: "2", 2: "3"})

    def test_lowercase_and_spacing_variants(self):
        for text, second in (
            ("page 1 of 3", "page 2 of 3"),
            ("PAGE  NUMBER  1  OF  3", "PAGE  NUMBER  2  OF  3"),
            ("Page:1 of 3", "Page:2 of 3"),
        ):
            with self.subTest(text=text):
                blocks = _doc(text, second)
                _apply_banner_page_labels(blocks, 3, [])
                self.assertEqual(_labels(blocks), {0: "1", 1: "2", 2: "3"})

    def test_prose_does_not_masquerade_as_a_banner(self):
        # "page 3 of the manual" has no second number, so it cannot anchor.
        blocks = _doc(
            "see page 3 of the unit manual for details",
            "ordinary body text",
        )
        _apply_banner_page_labels(blocks, 3, [])
        self.assertEqual(_labels(blocks), {})

    def test_disagreeing_page_count_still_refuses(self):
        warnings = []
        blocks = _doc("Page 1 of 9", "Page 2 of 9", page_count=3)
        _apply_banner_page_labels(blocks, 3, warnings)
        self.assertEqual(_labels(blocks), {})
        self.assertIn("printed_page_total_mismatch", warnings)

    def test_single_body_text_page_count_match_does_not_label_the_document(self):
        blocks = [
            RawBlock(page_index=0, kind="text", text="Page 1 of 4"),
            RawBlock(page_index=1, kind="text", text="ordinary body text"),
            RawBlock(page_index=2, kind="text", text="ordinary body text"),
            RawBlock(page_index=3, kind="text", text="ordinary body text"),
        ]
        _apply_banner_page_labels(blocks, 4, [])
        self.assertEqual(_labels(blocks), {})


if __name__ == "__main__":
    unittest.main()
