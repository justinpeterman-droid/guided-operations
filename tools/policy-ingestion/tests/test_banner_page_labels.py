import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from guided_policy_ingestion.extractors.mineru import _apply_banner_page_labels
from guided_policy_ingestion.models import RawBlock


def _blocks(page_count, banner_page=None, banner_total=None, banner_on=(0, 1)):
    made = []
    banner_pages = (banner_on,) if isinstance(banner_on, int) else banner_on
    for index in range(page_count):
        table = None
        if banner_page is not None and index in banner_pages:
            table = (
                "<table><tr><td>Benny Magness Unit</td>"
                f"<td>PAGE NUMBER {banner_page + index - banner_pages[0]} "
                f"OF {banner_total}</td></tr></table>"
            )
        made.append(
            RawBlock(
                page_index=index,
                kind="table" if table else "text",
                text="" if table else f"body text for page {index}",
                table_html=table,
            )
        )
    return made


def _labels_by_page(blocks):
    """The label normalization would pick for each page: first non-null."""
    found = {}
    for block in blocks:
        if block.printed_page_label and block.page_index not in found:
            found[block.page_index] = block.printed_page_label
    return found


def _surviving_text(blocks):
    """Text normalization would keep: blocks WITHOUT a printed page label."""
    return [b.text for b in blocks if not b.printed_page_label and b.text]


class BannerPageLabelTests(unittest.TestCase):
    def test_labels_every_page_from_repeated_leading_banners(self):
        blocks = _blocks(4, banner_page=1, banner_total=4)
        _apply_banner_page_labels(blocks, 4, [])
        self.assertEqual(_labels_by_page(blocks), {0: "1", 1: "2", 2: "3", 3: "4"})

    def test_does_not_swallow_page_content(self):
        # Regression: labelling content blocks made normalization skip their
        # text, emptying every page and producing zero chunks.
        blocks = _blocks(4, banner_page=1, banner_total=4)
        before = _surviving_text(blocks)
        _apply_banner_page_labels(blocks, 4, [])
        self.assertEqual(_surviving_text(blocks), before)
        self.assertEqual(len(before), 2)

    def test_labels_repeated_banners_found_on_later_pages(self):
        blocks = _blocks(4, banner_page=3, banner_total=4, banner_on=(2, 3))
        _apply_banner_page_labels(blocks, 4, [])
        self.assertEqual(_labels_by_page(blocks), {0: "1", 1: "2", 2: "3", 3: "4"})

    def test_refuses_a_banner_whose_numbering_overruns_the_declared_total(self):
        # "PAGE NUMBER 5 OF 3" is self-contradictory. Refuse rather than guess.
        warnings = []
        blocks = _blocks(3, banner_page=5, banner_total=3)
        _apply_banner_page_labels(blocks, 3, warnings)
        self.assertEqual(_labels_by_page(blocks), {})
        self.assertIn("printed_page_out_of_range", warnings)

    def test_refuses_to_guess_when_the_declared_total_disagrees(self):
        warnings = []
        blocks = _blocks(3, banner_page=1, banner_total=9)
        _apply_banner_page_labels(blocks, 3, warnings)
        self.assertEqual(_labels_by_page(blocks), {})
        self.assertIn("printed_page_total_mismatch", warnings)

    def test_refuses_when_two_banners_disagree_on_the_offset(self):
        warnings = []
        blocks = _blocks(3, banner_page=1, banner_total=3)
        blocks[2] = RawBlock(
            page_index=2,
            kind="table",
            text="",
            table_html="<table><tr><td>PAGE NUMBER 9 OF 3</td></tr></table>",
        )
        _apply_banner_page_labels(blocks, 3, warnings)
        self.assertEqual(_labels_by_page(blocks), {})
        self.assertIn("printed_page_anchors_inconsistent", warnings)

    def test_does_nothing_without_a_banner(self):
        blocks = _blocks(3)
        _apply_banner_page_labels(blocks, 3, [])
        self.assertEqual(_labels_by_page(blocks), {})

    def test_body_text_page_phrase_is_not_enough_to_label_a_document(self):
        blocks = _blocks(4)
        blocks[0] = RawBlock(
            page_index=0,
            kind="text",
            text="The form displays Page 1 of 4 in this example.",
        )
        _apply_banner_page_labels(blocks, 4, [])
        self.assertEqual(_labels_by_page(blocks), {})

    def test_leaves_discrete_page_number_blocks_untouched(self):
        blocks = _blocks(2, banner_page=1, banner_total=2)
        blocks[1] = RawBlock(
            page_index=1, kind="page_number", text="7", printed_page_label="7"
        )
        _apply_banner_page_labels(blocks, 2, [])
        self.assertEqual(_labels_by_page(blocks), {1: "7"})


if __name__ == "__main__":
    unittest.main()
