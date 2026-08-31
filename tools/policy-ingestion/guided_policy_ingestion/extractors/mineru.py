from __future__ import annotations

import hashlib
import json
import os
import re
import subprocess
from pathlib import Path
from typing import Any

from ..models import ExtractionResult, RawBlock, SourceFile
from .base import ExtractionError


def _text_fragments(value: Any) -> list[str]:
    if isinstance(value, str):
        return [value.strip()] if value.strip() else []
    if isinstance(value, list):
        return [fragment for item in value for fragment in _text_fragments(item)]
    if isinstance(value, dict):
        fragments: list[str] = []
        for key in (
            "text",
            "content",
            "paragraph_content",
            "title_content",
            "table_caption",
            "table_footnote",
            "table_body",
            "html",
        ):
            if key in value:
                fragments.extend(_text_fragments(value[key]))
        return fragments
    return []


def _text(block: dict[str, Any]) -> str:
    fragments = _text_fragments(block)
    if fragments:
        return "\n".join(fragments).strip()
    lines = block.get("lines")
    if isinstance(lines, list):
        parts = []
        for line in lines:
            if isinstance(line, str):
                parts.append(line)
            elif isinstance(line, dict):
                parts.append(str(line.get("text", "")))
        return "\n".join(part for part in parts if part).strip()
    return ""


def _flatten_content_list(
    payload: Any,
) -> tuple[list[dict[str, Any]], int, int]:
    if isinstance(payload, dict):
        payload = (
            payload.get("pages")
            or payload.get("content_list")
            or payload.get("blocks")
            or []
        )
    if not isinstance(payload, list):
        raise ExtractionError(
            "mineru_output_invalid",
            "MinerU content output was not a supported JSON list",
        )
    flattened: list[dict[str, Any]] = []
    page_indexes: set[int] = set()
    for position, item in enumerate(payload):
        if isinstance(item, list):
            page_indexes.add(position)
            for block in item:
                if isinstance(block, dict):
                    flattened.append(
                        {
                            **block,
                            "page_idx": block.get("page_idx", position),
                        }
                    )
            continue
        if not isinstance(item, dict):
            continue
        nested = (
            item.get("blocks")
            or item.get("content_list")
            or item.get("elements")
        )
        page_index = item.get("page_idx", item.get("page_index", position))
        try:
            page_index = int(page_index)
        except (TypeError, ValueError):
            page_index = position
        if isinstance(nested, list):
            page_indexes.add(page_index)
            for block in nested:
                if isinstance(block, dict):
                    flattened.append({**block, "page_idx": page_index})
        else:
            flattened.append({**item, "page_idx": page_index})
            page_indexes.add(page_index)
    declared_page_count = max(page_indexes) + 1 if page_indexes else 0
    observed_page_count = len(page_indexes)
    return flattened, declared_page_count, observed_page_count


def parse_mineru_content(path: Path, version: str) -> ExtractionResult:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as error:
        raise ExtractionError(
            "mineru_output_unreadable",
            "MinerU output JSON could not be read",
        ) from error
    items, page_count, observed_page_count = _flatten_content_list(payload)
    blocks: list[RawBlock] = []
    warnings: list[str] = []
    for item in items:
        page_index = int(item.get("page_idx", 0))
        kind = str(
            item.get("type", item.get("block_type", "text"))
        ).lower()
        block_text = _text(item)
        content = item.get("content")
        level_value = item.get("text_level", item.get("level"))
        if level_value is None and isinstance(content, dict):
            level_value = content.get("text_level", content.get("level"))
        try:
            heading_level = (
                int(level_value) if level_value is not None else None
            )
        except (TypeError, ValueError):
            heading_level = None
        printed_page_label = None
        if (
            kind in {"page_number", "page-number", "page_footer_number"}
            and block_text
        ):
            printed_page_label = block_text[:80]
        warning_codes: list[str] = []
        if not block_text and kind not in {"image", "figure", "discarded"}:
            warning_codes.append("empty_block")
        table_html = (
            block_text
            if kind == "table" and "<table" in block_text.lower()
            else None
        )
        confidence = item.get(
            "ocr_confidence", item.get("confidence", item.get("score"))
        )
        try:
            confidence = float(confidence) if confidence is not None else None
        except (TypeError, ValueError):
            confidence = None
        if confidence is not None and not 0 <= confidence <= 1:
            confidence = None
        blocks.append(
            RawBlock(
                page_index=page_index,
                kind=kind,
                text=block_text,
                heading_level=heading_level,
                printed_page_label=printed_page_label,
                table_html=table_html,
                warning_codes=tuple(warning_codes),
                metadata={
                    "source": path.name,
                    "ocr_confidence": confidence,
                },
            )
        )
    if not blocks:
        warnings.append("no_content_blocks")
    _apply_banner_page_labels(blocks, page_count, warnings)
    return ExtractionResult(
        blocks=tuple(blocks),
        page_count=page_count,
        extraction_tool="mineru",
        extraction_version=version,
        extraction_model_version=None,
        warnings=tuple(warnings),
        layout_reference=path.name,
        layout_metadata_sha256=hashlib.sha256(path.read_bytes()).hexdigest(),
        observed_page_count=observed_page_count,
    )


# Three masthead dialects appear across the corpus and all state the same fact:
#   "PAGE NUMBER 1 OF 4"  (unit policies)
#   "Page 1 of 6"         (post orders)
#   "PAGE: 1 of 11"       (secretarial directives)
# Digits are required on both sides of "of" so prose like "page 3 of the manual"
# cannot match. The page-count agreement check below is what ultimately makes a
# derived label trustworthy; a false label is worse than none.
_BANNER_PAGE = re.compile(
    r"PAGE\s*(?:NUMBER)?\s*:?\s*(\d{1,4})\s*OF\s*(\d{1,4})", re.IGNORECASE
)


def _apply_banner_page_labels(
    blocks: list[RawBlock], page_count: int, warnings: list[str]
) -> None:
    """Derive printed page labels from a repeated header banner.

    Some policy sets state the printed page inside the masthead table
    ("PAGE NUMBER 1 OF 4") rather than as a discrete page-number block, so the
    discrete-block path above never fires and every chunk cites no printed page.

    A banner is used as an anchor only when the document's own page count
    matches the total the banner declares. That equality is what makes the
    offset check safe: it proves the extractor saw the same number of pages the
    document claims, so page N of the extraction is page (anchor + N - anchor
    index) of the document. Without that agreement - a cover sheet, a merged
    scan, a dropped page - the labels are left unset rather than guessed. A
    wrong page citation is worse than an absent one.
    """
    if not blocks or page_count <= 0:
        return
    if any(block.printed_page_label for block in blocks):
        return

    anchors: dict[int, int] = {}
    declared_totals: set[int] = set()
    for block in blocks:
        haystack = block.table_html or block.text or ""
        match = _BANNER_PAGE.search(haystack)
        if match:
            anchors.setdefault(block.page_index, int(match.group(1)))
            declared_totals.add(int(match.group(2)))

    if not anchors or len(declared_totals) != 1:
        return
    declared_total = declared_totals.pop()
    if declared_total != page_count:
        warnings.append("printed_page_total_mismatch")
        return

    anchor_index = min(anchors)
    offset = anchors[anchor_index] - anchor_index
    if any(value - index != offset for index, value in anchors.items()):
        warnings.append("printed_page_anchors_inconsistent")
        return

    seen: set[int] = set()
    for block in blocks:
        if block.page_index in seen:
            continue
        label = block.page_index + offset
        if label < 1 or label > declared_total:
            warnings.append("printed_page_out_of_range")
            return
        seen.add(block.page_index)

    for page_index in sorted(seen):
        blocks.append(
            RawBlock(
                page_index=page_index,
                kind="page_number",
                text="",
                printed_page_label=str(page_index + offset),
                metadata={"source": "banner_derived"},
            )
        )


class MinerUProvider:
    name = "mineru"

    def __init__(
        self,
        executable: str = "mineru",
        backend: str = "auto",
        version: str = "3.4.5",
    ):
        self.executable = executable
        self.backend = backend
        self.version = version

    def extract(self, source: SourceFile, output_dir: Path) -> ExtractionResult:
        output_dir.mkdir(parents=True, exist_ok=True)
        command = [
            self.executable,
            "-p",
            str(source.path),
            "-o",
            str(output_dir),
        ]
        if self.backend != "auto":
            command.extend(["-b", self.backend])
        environment = os.environ.copy()
        environment["MINERU_TABLE_MERGE_ENABLE"] = "0"
        try:
            completed = subprocess.run(
                command,
                env=environment,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                check=False,
            )
        except FileNotFoundError as error:
            raise ExtractionError(
                "mineru_not_installed",
                "MinerU is not installed or is not on PATH",
            ) from error
        if completed.returncode != 0:
            raise ExtractionError(
                "mineru_failed",
                "MinerU extraction failed; inspect the private local extraction folder",
            )
        candidates = sorted(output_dir.rglob("*_content_list_v2.json"))
        if not candidates:
            candidates = sorted(output_dir.rglob("*_content_list.json"))
        if not candidates:
            candidates = sorted(
                output_dir.rglob("content_list_v2.json")
            ) or sorted(output_dir.rglob("content_list.json"))
        if not candidates:
            raise ExtractionError(
                "mineru_output_missing",
                "MinerU did not create a supported content-list JSON file",
            )
        return parse_mineru_content(candidates[0], self.version)
