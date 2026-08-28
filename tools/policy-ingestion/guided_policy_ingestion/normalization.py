from __future__ import annotations

import hashlib
import re
import unicodedata
from collections import defaultdict

from .models import ExtractionResult, NormalizedPage, SourceFile

NORMALIZATION_VERSION = "unicode-nfkc-lines-v1"


def normalize_text(value: str) -> str:
    value = unicodedata.normalize("NFKC", value).replace("\r\n", "\n").replace("\r", "\n")
    lines = [re.sub(r"[ \t]+", " ", line).strip() for line in value.split("\n")]
    return "\n".join(line for line in lines if line).strip()


def _mode(source: SourceFile, has_text: bool) -> str:
    if not has_text:
        return "mixed"
    if source.media_type.startswith("image/"):
        return "ocr"
    if source.media_type.endswith("wordprocessingml.document"):
        return "native"
    return "mixed"


def normalize_extraction(source: SourceFile, extraction: ExtractionResult) -> tuple[NormalizedPage, ...]:
    by_page: dict[int, list] = defaultdict(list)
    for block in extraction.blocks:
        by_page[block.page_index].append(block)
    page_count = extraction.page_count or (max(by_page) + 1 if by_page else 0)
    heading_stack: list[str] = []
    pages: list[NormalizedPage] = []
    for zero_based_index in range(page_count):
        page_blocks = by_page.get(zero_based_index, [])
        printed_label = next(
            (block.printed_page_label for block in page_blocks if block.printed_page_label),
            None,
        )
        parts: list[str] = []
        warnings: set[str] = set()
        first_heading: str | None = None
        for block in page_blocks:
            warnings.update(block.warning_codes)
            if block.printed_page_label:
                continue
            text = normalize_text(block.text)
            if not text:
                continue
            is_heading = block.kind in {"title", "heading", "section_header"} or block.heading_level is not None
            if is_heading:
                level = max(1, min(block.heading_level or 1, 6))
                heading_stack[:] = heading_stack[: level - 1]
                heading_stack.append(text[:500])
                first_heading = first_heading or text[:500]
            if block.kind == "table" and block.table_html:
                parts.append(f"[TABLE]\n{text}\n[/TABLE]")
            else:
                parts.append(text)
        normalized = normalize_text("\n\n".join(parts))
        quality_flags: list[str] = []
        if not normalized:
            quality_flags.append("empty_page")
            warnings.add("empty_page_requires_review")
        elif len(normalized) < 40:
            quality_flags.append("suspiciously_short_page")
        mode = _mode(source, bool(normalized))
        if source.media_type == "application/pdf":
            warnings.add("pdf_extraction_mode_inferred")
        confidences = [
            float(block.metadata["ocr_confidence"])
            for block in page_blocks
            if block.metadata.get("ocr_confidence") is not None
        ]
        ocr_confidence = sum(confidences) / len(confidences) if confidences else None
        layout_ref = extraction.layout_reference
        pages.append(
            NormalizedPage(
                source_page_index=zero_based_index + 1,
                printed_page_label=printed_label,
                normalized_text=normalized,
                normalized_text_sha256=hashlib.sha256(normalized.encode("utf-8")).hexdigest(),
                extraction_mode=mode,
                heading=first_heading,
                section_path=" > ".join(heading_stack) if heading_stack else None,
                ocr_confidence=ocr_confidence,
                quality_flags=tuple(sorted(quality_flags)),
                warning_codes=tuple(sorted(warnings)),
                extraction_warning="; ".join(sorted(warnings))[:500] if warnings else None,
                structured_layout_ref=layout_ref,
                layout_metadata_sha256=extraction.layout_metadata_sha256,
            )
        )
    return tuple(pages)
