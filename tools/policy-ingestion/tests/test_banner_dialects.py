import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from guided_policy_ingestion.extractors.mineru import _apply_banner_page_labels
from guided_policy_ingestion.models import RawBlock


def _doc(banner_text, page_count=3):
    """One banner block on page 0, plain body text on the rest."""
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
            RawBlock(page_index=i, kind="text", text="body text page %d" % i)
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
        blocks = _doc("PAGE NUMBER 1 OF 3")
        _apply_banner_page_labels(blocks, 3, [])
        self.assertEqual(_labels(blocks), {0: "1", 1: "2", 2: "3"})

    def test_post_order_dialect(self):
        blocks = _doc("Effective Date: 2/27/2026    Page 1 of 3")
        _apply_banner_page_labels(blocks, 3, [])
        self.assertEqual(_labels(blocks), {0: "1", 1: "2", 2: "3"})

    def test_secretarial_directive_dialect(self):
        blocks = _doc("PAGE: 1 of 3")
        _apply_banner_page_labels(blocks, 3, [])
        self.assertEqual(_labels(blocks), {0: "1", 1: "2", 2: "3"})

    def test_lowercase_and_spacing_variants(self):
        for text in ("page 1 of 3", "PAGE  NUMBER  1  OF  3", "Page:1 of 3"):
            with self.subTest(text=text):
                blocks = _doc(text)
                _apply_banner_page_labels(blocks, 3, [])
                self.assertEqual(_labels(blocks), {0: "1", 1: "2", 2: "3"})

    def test_prose_does_not_masquerade_as_a_banner(self):
        # "page 3 of the manual" has no second number, so it cannot anchor.
        blocks = _doc("see page 3 of the unit manual for details")
        _apply_banner_page_labels(blocks, 3, [])
        self.assertEqual(_labels(blocks), {})

    def test_disagreeing_page_count_still_refuses(self):
        warnings = []
        blocks = _doc("Page 1 of 9", page_count=3)
        _apply_banner_page_labels(blocks, 3, warnings)
        self.assertEqual(_labels(blocks), {})
        self.assertIn("printed_page_total_mismatch", warnings)


if __name__ == "__main__":
    unittest.main()
