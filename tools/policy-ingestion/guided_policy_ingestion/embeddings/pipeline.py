from __future__ import annotations

from .base import (
    EmbeddingBatchSummary,
    EmbeddingProfile,
    EmbeddingProvider,
    EmbeddingRepository,
)


class EmbeddingPipeline:
    def __init__(
        self,
        repository: EmbeddingRepository,
        provider: EmbeddingProvider,
        profile_key: str,
        *,
        batch_size: int = 16,
    ):
        if batch_size < 1 or batch_size > 64:
            raise ValueError("Embedding batch size must be between 1 and 64")
        self.repository = repository
        self.provider = provider
        self.profile = EmbeddingProfile(
            profile_key=profile_key,
            provider=provider.provider_key,
            model=provider.model,
            dimensions=provider.dimensions,
        )
        self.batch_size = batch_size

    def run(self, document_version_id: str, *, limit: int | None = None) -> EmbeddingBatchSummary:
        if limit is not None and limit < 1:
            raise ValueError("Embedding limit must be at least 1")
        self.repository.require_profile(self.profile)
        eligible, existing = self.repository.count_eligible(
            document_version_id,
            self.profile.profile_key,
        )
        requested = eligible - existing if limit is None else min(limit, eligible - existing)
        embedded = 0

        while embedded < requested:
            batch_limit = min(self.batch_size, requested - embedded)
            chunks = self.repository.next_chunks(
                document_version_id,
                self.profile.profile_key,
                batch_limit,
            )
            if not chunks:
                break
            chunk_ids = tuple(chunk.chunk_id for chunk in chunks)
            with self.repository.lock_eligible(
                document_version_id,
                self.profile.profile_key,
                chunk_ids,
            ) as eligible:
                if not eligible:
                    raise RuntimeError("Embedding eligibility changed before provider processing")
                vectors = self.provider.embed(tuple(chunk.content for chunk in chunks))
            if len(vectors) != len(chunks):
                raise RuntimeError("Embedding provider returned an incomplete batch")
            stored = self.repository.store(self.profile.profile_key, chunks, vectors)
            if stored != len(chunks):
                raise RuntimeError("Embedding batch was not stored completely")
            embedded += stored

        final_eligible, final_existing = self.repository.count_eligible(
            document_version_id,
            self.profile.profile_key,
        )
        return EmbeddingBatchSummary(
            document_version_id=document_version_id,
            profile_key=self.profile.profile_key,
            eligible=final_eligible,
            embedded=embedded,
            skipped_existing=existing,
            remaining=max(0, final_eligible - final_existing),
        )
