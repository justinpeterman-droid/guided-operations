from __future__ import annotations

from dataclasses import dataclass
from typing import ContextManager, Protocol


@dataclass(frozen=True)
class EmbeddingProfile:
    profile_key: str
    provider: str
    model: str
    dimensions: int


@dataclass(frozen=True)
class EmbeddingChunk:
    chunk_id: str
    content: str


@dataclass(frozen=True)
class EmbeddingBatchSummary:
    document_version_id: str
    profile_key: str
    eligible: int
    embedded: int
    skipped_existing: int
    remaining: int


class EmbeddingProvider(Protocol):
    provider_key: str
    model: str
    dimensions: int

    def embed(self, texts: tuple[str, ...]) -> tuple[tuple[float, ...], ...]: ...


class EmbeddingRepository(Protocol):
    def require_profile(self, profile: EmbeddingProfile) -> None: ...

    def count_eligible(self, document_version_id: str, profile_key: str) -> tuple[int, int]: ...

    def next_chunks(
        self,
        document_version_id: str,
        profile_key: str,
        limit: int,
    ) -> tuple[EmbeddingChunk, ...]: ...

    def lock_eligible(
        self,
        document_version_id: str,
        profile_key: str,
        chunk_ids: tuple[str, ...],
    ) -> ContextManager[bool]: ...

    def store(
        self,
        profile_key: str,
        chunks: tuple[EmbeddingChunk, ...],
        vectors: tuple[tuple[float, ...], ...],
    ) -> int: ...
