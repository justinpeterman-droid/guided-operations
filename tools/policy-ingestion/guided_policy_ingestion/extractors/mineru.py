from __future__ import annotations

import hashlib
import json
import os
import subprocess
from pathlib import Path
from typing import Any

from ..models import ExtractionResult, RawBlock, SourceFile
from .base import ExtractionError


def _text(block: dict[str, Any]) -> str:
    for key in ("text", "content", "table_body", "html"):
        value = block.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
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


def _flatten_content_list(payload: Any) -> tuple[list[dict[str, Any]], int]:
    if isinstance(payload, dict):
        payload = payload.get("pages") or payload.get("content_list") or payload.get("blocks") or []
    if not isinstance(payload, list):
        raise ExtractionError("mineru_output_invalid", "MinerU content output was not a supported JSON list")
    flattened: list[dict[str, Any]] = []
    page_indexes: set[int] = set()
    for position, item in enumerate(payload):
        if not isinstance(item, dict):
            continue
        nested = item.get("blocks") or item.get("content_list") or item.get("elements")
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
    page_count = max(page_indexes) + 1 if page_indexes else 0
    return flattened, page_count


def parse_mineru_content(path: Path, version: str) -> ExtractionResult:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as error:
        raise ExtractionError("mineru_output_unreadable", "MinerU output JSON could not be read") from error
    items, page_count = _flatten_content_list(payload)
    blocks: list[RawBlock] = []
    warnings: list[str] = []
    for item in items:
        page_index = int(item.get("page_idx", 0))
        kind = str(item.get("type", item.get("block_type", "text"))).lower()
        block_text = _text(item)
        level_value = item.get("text_level", item.get("level"))
        try:
            heading_level = int(level_value) if level_value is not None else None
        except (TypeError, ValueError):
            heading_level = None
        printed_page_label = None
        if kind in {"page_number", "page-number", "page_footer_number"} and block_text:
            printed_page_label = block_text[:80]
        warning_codes: list[str] = []
        if not block_text and kind not in {"image", "figure", "discarded"}:
            warning_codes.append("empty_block")
        table_html = block_text if kind == "table" and "<table" in block_text.lower() else None
        confidence = item.get("ocr_confidence", item.get("confidence", item.get("score")))
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
                metadata={"source": path.name, "ocr_confidence": confidence},
            )
        )
    if not blocks:
        warnings.append("no_content_blocks")
    return ExtractionResult(
        blocks=tuple(blocks),
        page_count=page_count,
        extraction_tool="mineru",
        extraction_version=version,
        extraction_model_version=None,
        warnings=tuple(warnings),
        layout_reference=path.name,
        layout_metadata_sha256=hashlib.sha256(path.read_bytes()).hexdigest(),
    )


class MinerUProvider:
    name = "mineru"

    def __init__(self, executable: str = "mineru", backend: str = "auto", version: str = "3.4.5"):
        self.executable = executable
        self.backend = backend
        self.version = version

    def extract(self, source: SourceFile, output_dir: Path) -> ExtractionResult:
        output_dir.mkdir(parents=True, exist_ok=True)
        command = [self.executable, "-p", str(source.path), "-o", str(output_dir)]
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
            raise ExtractionError("mineru_not_installed", "MinerU is not installed or is not on PATH") from error
        if completed.returncode != 0:
            raise ExtractionError("mineru_failed", "MinerU extraction failed; inspect the private local extraction folder")
        candidates = sorted(output_dir.rglob("*_content_list_v2.json"))
        if not candidates:
            candidates = sorted(output_dir.rglob("*_content_list.json"))
        if not candidates:
            candidates = sorted(output_dir.rglob("content_list_v2.json")) or sorted(
                output_dir.rglob("content_list.json")
            )
        if not candidates:
            raise ExtractionError("mineru_output_missing", "MinerU did not create a supported content-list JSON file")
        return parse_mineru_content(candidates[0], self.version)
