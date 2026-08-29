from __future__ import annotations

import json
import unittest
import urllib.request
from contextlib import contextmanager

from guided_policy_ingestion.embeddings.base import EmbeddingChunk, EmbeddingProfile
from guided_policy_ingestion.embeddings.openai import OpenAIEmbeddingProvider
from guided_policy_ingestion.embeddings.pipeline import EmbeddingPipeline


class FakeRepository:
    def __init__(self, chunks: tuple[EmbeddingChunk, ...], existing: int = 0):
        self.chunks = list(chunks)
        self.existing = existing
        self.stored: list[str] = []
        self.recheck_allowed = True
        self.lock_active = False

    def require_profile(self, profile: EmbeddingProfile) -> None:
        if profile.profile_key != "fictional.openai-v1":
            raise RuntimeError("unexpected fictional profile")

    def count_eligible(self, document_version_id: str, profile_key: str) -> tuple[int, int]:
        return len(self.chunks) + self.existing, self.existing + len(self.stored)

    def next_chunks(
        self, document_version_id: str, profile_key: str, limit: int
    ) -> tuple[EmbeddingChunk, ...]:
        unstored = [chunk for chunk in self.chunks if chunk.chunk_id not in self.stored]
        return tuple(unstored[:limit])

    @contextmanager
    def lock_eligible(
        self, document_version_id: str, profile_key: str, chunk_ids: tuple[str, ...]
    ):
        self.lock_active = True
        try:
            yield self.recheck_allowed
        finally:
            self.lock_active = False

    def store(self, profile_key, chunks, vectors) -> int:
        self.stored.extend(chunk.chunk_id for chunk in chunks)
        return len(chunks)


class FakeProvider:
    provider_key = "openai"
    model = "fictional-embedding-model"
    dimensions = 3

    def __init__(self, repository: FakeRepository | None = None):
        self.batches: list[tuple[str, ...]] = []
        self.repository = repository

    def embed(self, texts: tuple[str, ...]) -> tuple[tuple[float, ...], ...]:
        if self.repository is not None and not self.repository.lock_active:
            raise RuntimeError("fictional provider call occurred outside the eligibility lock")
        self.batches.append(texts)
        return tuple((1.0, 0.0, 0.0) for _ in texts)


class EmbeddingPipelineTests(unittest.TestCase):
    def test_resume_skips_existing_and_stores_bounded_batches(self) -> None:
        repository = FakeRepository(
            (
                EmbeddingChunk("11111111-1111-4111-8111-111111111111", "Fictional one"),
                EmbeddingChunk("22222222-2222-4222-8222-222222222222", "Fictional two"),
                EmbeddingChunk("33333333-3333-4333-8333-333333333333", "Fictional three"),
            ),
            existing=2,
        )
        provider = FakeProvider(repository)
        summary = EmbeddingPipeline(
            repository, provider, "fictional.openai-v1", batch_size=2
        ).run("44444444-4444-4444-8444-444444444444")

        self.assertEqual(summary.eligible, 5)
        self.assertEqual(summary.skipped_existing, 2)
        self.assertEqual(summary.embedded, 3)
        self.assertEqual(summary.remaining, 0)
        self.assertEqual([len(batch) for batch in provider.batches], [2, 1])

    def test_changed_eligibility_stops_before_provider_processing(self) -> None:
        repository = FakeRepository(
            (EmbeddingChunk("11111111-1111-4111-8111-111111111111", "Fictional"),)
        )
        repository.recheck_allowed = False
        provider = FakeProvider(repository)

        with self.assertRaisesRegex(RuntimeError, "eligibility changed"):
            EmbeddingPipeline(repository, provider, "fictional.openai-v1").run(
                "44444444-4444-4444-8444-444444444444"
            )
        self.assertEqual(provider.batches, [])

    def test_openai_adapter_validates_order_model_and_dimensions(self) -> None:
        observed: dict[str, object] = {}

        def transport(request: urllib.request.Request, timeout: float) -> bytes:
            observed["url"] = request.full_url
            observed["timeout"] = timeout
            observed["body"] = json.loads(request.data or b"{}")
            return json.dumps(
                {
                    "object": "list",
                    "model": "fictional-embedding-model",
                    "data": [
                        {"object": "embedding", "index": 1, "embedding": [0, 1, 0]},
                        {"object": "embedding", "index": 0, "embedding": [1, 0, 0]},
                    ],
                }
            ).encode()

        provider = OpenAIEmbeddingProvider(
            "x" * 20,
            "fictional-embedding-model",
            3,
            transport=transport,
        )
        vectors = provider.embed(("Fictional one", "Fictional two"))

        self.assertEqual(vectors, ((1.0, 0.0, 0.0), (0.0, 1.0, 0.0)))
        self.assertEqual(observed["url"], "https://api.openai.com/v1/embeddings")
        self.assertEqual(
            observed["body"],
            {
                "model": "fictional-embedding-model",
                "input": ["Fictional one", "Fictional two"],
                "encoding_format": "float",
                "dimensions": 3,
            },
        )

    def test_openai_adapter_rejects_wrong_model_and_zero_vector(self) -> None:
        def wrong_model(request: urllib.request.Request, timeout: float) -> bytes:
            return json.dumps(
                {
                    "model": "wrong-model",
                    "data": [{"object": "embedding", "index": 0, "embedding": [1, 0, 0]}],
                }
            ).encode()

        provider = OpenAIEmbeddingProvider(
            "x" * 20, "fictional-embedding-model", 3, transport=wrong_model
        )
        with self.assertRaisesRegex(RuntimeError, "unexpected model"):
            provider.embed(("Fictional",))

        def zero_vector(request: urllib.request.Request, timeout: float) -> bytes:
            return json.dumps(
                {
                    "model": "fictional-embedding-model",
                    "data": [{"object": "embedding", "index": 0, "embedding": [0, 0, 0]}],
                }
            ).encode()

        provider = OpenAIEmbeddingProvider(
            "x" * 20, "fictional-embedding-model", 3, transport=zero_vector
        )
        with self.assertRaisesRegex(RuntimeError, "zero vector"):
            provider.embed(("Fictional",))


if __name__ == "__main__":
    unittest.main()
