from __future__ import annotations

import hashlib
import re
import uuid
from dataclasses import dataclass

from .config import ChunkingConfig
from .models import NormalizedPage, PolicyChunk, SourceFile

CHUNK_NAMESPACE = uuid.UUID("cb6b2813-6895-45af-b943-da9e63a25925")


@dataclass(frozen=True)
class _Unit:
    text: str
    page: int
    printed_page_label: str | None
    section_path: str | None


def _split_long_text(text: str, maximum: int) -> list[str]:
    if len(text) <= maximum:
        return [text]
    sentences = re.split(r"(?<=[.!?])\s+|\n{2,}", text)
    pieces: list[str] = []
    current = ""
    for sentence in sentences:
        sentence = sentence.strip()
        if not sentence:
            continue
        if len(sentence) > maximum:
            if current:
                pieces.append(current)
                current = ""
            pieces.extend(sentence[index : index + maximum] for index in range(0, len(sentence), maximum))
        elif not current or len(current) + len(sentence) + 1 <= maximum:
            current = f"{current} {sentence}".strip()
        else:
            pieces.append(current)
            current = sentence
    if current:
        pieces.append(current)
    return pieces


def chunk_pages(
    source: SourceFile,
    pages: tuple[NormalizedPage, ...],
    config: ChunkingConfig,
    extraction_config_sha256: str,
) -> tuple[PolicyChunk, ...]:
    units: list[_Unit] = []
    for page in pages:
        for piece in _split_long_text(page.normalized_text, config.maximum_characters):
            if piece:
                units.append(
                    _Unit(piece, page.source_page_index, page.printed_page_label, page.section_path)
                )
    grouped: list[list[_Unit]] = []
    current: list[_Unit] = []
    for unit in units:
        candidate = current + [unit]
        candidate_size = sum(len(item.text) for item in candidate) + max(0, len(candidate) - 1) * 2
        page_span = unit.page - candidate[0].page + 1
        section_changed = bool(current and current[-1].section_path != unit.section_path)
        should_break = bool(
            current
            and (
                candidate_size > config.maximum_characters
                or page_span > config.maximum_pages
                or (section_changed and sum(len(item.text) for item in current) >= config.target_characters // 2)
            )
        )
        if should_break:
            grouped.append(current)
            current = [unit]
        else:
            current = candidate
        if sum(len(item.text) for item in current) >= config.target_characters:
            grouped.append(current)
            current = []
    if current:
        grouped.append(current)

    chunks: list[PolicyChunk] = []
    for ordinal, group in enumerate(grouped):
        content = "\n\n".join(item.text for item in group).strip()
        content_sha = hashlib.sha256(content.encode("utf-8")).hexdigest()
        identity_input = "|".join(
            (
                source.sha256,
                source.collection,
                extraction_config_sha256,
                config.sha256,
                str(ordinal),
                str(group[0].page),
                str(group[-1].page),
                group[0].section_path or "",
                content_sha,
            )
        )
        identity_sha = hashlib.sha256(identity_input.encode("utf-8")).hexdigest()
        chunks.append(
            PolicyChunk(
                id=str(uuid.uuid5(CHUNK_NAMESPACE, identity_sha)),
                ordinal=ordinal,
                content=content,
                content_sha256=content_sha,
                page_start=group[0].page,
                page_end=group[-1].page,
                printed_page_start=group[0].printed_page_label,
                printed_page_end=group[-1].printed_page_label,
                section_path=group[0].section_path,
                source_sha256=source.sha256,
                collection=source.collection,
                chunk_identity_sha256=identity_sha,
                token_count=max(1, len(content.split())),
            )
        )
    return tuple(chunks)
