from __future__ import annotations

import json
import math
import urllib.error
import urllib.request
from collections.abc import Callable

from .base import EmbeddingProvider

Transport = Callable[[urllib.request.Request, float], bytes]


def _default_transport(request: urllib.request.Request, timeout: float) -> bytes:
    with urllib.request.urlopen(request, timeout=timeout) as response:  # noqa: S310 - fixed HTTPS origin
        return response.read()


class OpenAIEmbeddingProvider(EmbeddingProvider):
    provider_key = "openai"

    def __init__(
        self,
        api_key: str,
        model: str,
        dimensions: int,
        *,
        timeout_seconds: float = 60.0,
        transport: Transport = _default_transport,
    ):
        if len(api_key) < 20:
            raise ValueError("A valid OpenAI API key is required")
        if not model or len(model) > 160:
            raise ValueError("A bounded OpenAI embedding model is required")
        if dimensions < 1 or dimensions > 16_000:
            raise ValueError("Embedding dimensions must be between 1 and 16000")
        if timeout_seconds < 1 or timeout_seconds > 300:
            raise ValueError("Embedding timeout must be between 1 and 300 seconds")
        self.api_key = api_key
        self.model = model
        self.dimensions = dimensions
        self.timeout_seconds = timeout_seconds
        self.transport = transport

    def embed(self, texts: tuple[str, ...]) -> tuple[tuple[float, ...], ...]:
        if not texts or len(texts) > 64:
            raise ValueError("Embedding batches must contain between 1 and 64 chunks")
        normalized = tuple(text.strip() for text in texts)
        if any(not text or len(text) > 20_000 for text in normalized):
            raise ValueError("Embedding chunk text is empty or exceeds the ingestion bound")

        request = urllib.request.Request(
            "https://api.openai.com/v1/embeddings",
            method="POST",
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
            data=json.dumps(
                {
                    "model": self.model,
                    "input": normalized,
                    "encoding_format": "float",
                    "dimensions": self.dimensions,
                },
                separators=(",", ":"),
            ).encode("utf-8"),
        )
        try:
            body = self.transport(request, self.timeout_seconds)
            payload = json.loads(body)
        except (OSError, urllib.error.URLError, UnicodeError, json.JSONDecodeError) as error:
            raise RuntimeError("Embedding provider unavailable; private details were not printed") from error

        if not isinstance(payload, dict) or payload.get("model") != self.model:
            raise RuntimeError("Embedding provider returned an unexpected model")
        data = payload.get("data")
        if not isinstance(data, list) or len(data) != len(normalized):
            raise RuntimeError("Embedding provider returned an unexpected batch")

        ordered: list[tuple[float, ...] | None] = [None] * len(normalized)
        for item in data:
            if not isinstance(item, dict) or item.get("object") != "embedding":
                raise RuntimeError("Embedding provider returned malformed data")
            index = item.get("index")
            vector = item.get("embedding")
            if (
                not isinstance(index, int)
                or index < 0
                or index >= len(ordered)
                or ordered[index] is not None
                or not isinstance(vector, list)
                or len(vector) != self.dimensions
                or any(
                    not isinstance(value, (int, float))
                    or isinstance(value, bool)
                    or not math.isfinite(float(value))
                    for value in vector
                )
            ):
                raise RuntimeError("Embedding provider returned malformed data")
            normalized_vector = tuple(float(value) for value in vector)
            if not any(value != 0 for value in normalized_vector):
                raise RuntimeError("Embedding provider returned a zero vector")
            ordered[index] = normalized_vector

        if any(vector is None for vector in ordered):
            raise RuntimeError("Embedding provider returned an incomplete batch")
        return tuple(vector for vector in ordered if vector is not None)

