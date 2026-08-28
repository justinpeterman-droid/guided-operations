from __future__ import annotations

from pathlib import Path

from .config import ChunkingConfig
from .discovery import sha256_file
from .models import NormalizedPage, PolicyChunk, SourceFile, ValidationResult


def validate_document(
    source: SourceFile,
    pages: tuple[NormalizedPage, ...],
    chunks: tuple[PolicyChunk, ...],
    config: ChunkingConfig,
    expected_page_count: int | None = None,
    recheck_source: bool = True,
) -> ValidationResult:
    errors: list[str] = []
    warnings: set[str] = set()
    quality_flags: set[str] = set()
    if recheck_source and sha256_file(Path(source.path)) != source.sha256:
        errors.append("source_sha256_changed_during_processing")
    if expected_page_count is not None and expected_page_count != len(pages):
        errors.append("extracted_page_count_mismatch")
    expected_indexes = list(range(1, len(pages) + 1))
    if [page.source_page_index for page in pages] != expected_indexes:
        errors.append("page_numbers_not_continuous")
    if pages and not chunks and any(page.normalized_text for page in pages):
        errors.append("non_empty_document_has_no_chunks")
    if not pages:
        errors.append("document_has_no_pages")
    real_pages = set(expected_indexes)
    for page in pages:
        warnings.update(page.warning_codes)
        quality_flags.update(page.quality_flags)
    for chunk in chunks:
        if not chunk.content_sha256 or not chunk.chunk_identity_sha256:
            errors.append("chunk_hash_missing")
        if chunk.page_start not in real_pages or chunk.page_end not in real_pages:
            errors.append("chunk_maps_to_missing_page")
        if chunk.page_end - chunk.page_start + 1 > config.maximum_pages:
            errors.append("chunk_page_span_exceeds_configuration")
        if chunk.collection != source.collection or chunk.source_sha256 != source.sha256:
            errors.append("chunk_provenance_mismatch")
    low_quality = bool(quality_flags & {"empty_page", "suspiciously_short_page"})
    if low_quality:
        warnings.add("low_quality_extraction_requires_review")
    if errors:
        return ValidationResult("failed", tuple(sorted(set(errors))), tuple(sorted(warnings)), tuple(sorted(quality_flags)))
    return ValidationResult(
        "awaiting_review",
        (),
        tuple(sorted(warnings)),
        tuple(sorted(quality_flags)),
    )
