from __future__ import annotations

from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Literal

ExtractionMode = Literal["native", "ocr", "mixed", "empty_expected"]


@dataclass(frozen=True)
class SourceFile:
    path: Path
    collection: str
    relative_path: str
    filename: str
    sha256: str
    media_type: str
    size_bytes: int


@dataclass(frozen=True)
class RawBlock:
    page_index: int
    kind: str
    text: str
    heading_level: int | None = None
    printed_page_label: str | None = None
    table_html: str | None = None
    warning_codes: tuple[str, ...] = ()
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class ExtractionResult:
    blocks: tuple[RawBlock, ...]
    page_count: int
    extraction_tool: str
    extraction_version: str
    extraction_model_version: str | None
    warnings: tuple[str, ...] = ()
    layout_reference: str | None = None
    layout_metadata_sha256: str | None = None


@dataclass(frozen=True)
class NormalizedPage:
    source_page_index: int
    printed_page_label: str | None
    normalized_text: str
    normalized_text_sha256: str
    extraction_mode: ExtractionMode
    heading: str | None
    section_path: str | None
    ocr_confidence: float | None = None
    quality_flags: tuple[str, ...] = ()
    warning_codes: tuple[str, ...] = ()
    extraction_warning: str | None = None
    structured_layout_ref: str | None = None
    layout_metadata_sha256: str | None = None


@dataclass(frozen=True)
class PolicyChunk:
    id: str
    ordinal: int
    content: str
    content_sha256: str
    page_start: int
    page_end: int
    printed_page_start: str | None
    printed_page_end: str | None
    section_path: str | None
    source_sha256: str
    collection: str
    chunk_identity_sha256: str
    token_count: int


@dataclass(frozen=True)
class ValidationResult:
    status: Literal["awaiting_review", "failed", "quarantined"]
    errors: tuple[str, ...]
    warnings: tuple[str, ...]
    quality_flags: tuple[str, ...]


def jsonable(value: Any) -> Any:
    if isinstance(value, Path):
        return str(value)
    if hasattr(value, "__dataclass_fields__"):
        return {key: jsonable(item) for key, item in asdict(value).items()}
    if isinstance(value, dict):
        return {key: jsonable(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [jsonable(item) for item in value]
    return value
