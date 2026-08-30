from __future__ import annotations

import hashlib
import json
import os
from dataclasses import asdict, dataclass
from pathlib import Path


def canonical_json_hash(value: object) -> str:
    encoded = json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


def default_work_dir() -> Path:
    local_app_data = os.environ.get("LOCALAPPDATA")
    base = Path(local_app_data) if local_app_data else Path.home() / ".local" / "share"
    return base / "GuidedOperations" / "policy-ingestion"


@dataclass(frozen=True)
class ExtractionConfig:
    provider: str = "mineru"
    provider_version: str = "3.4.5"
    backend: str = "auto"
    ocr_language: str = "en"
    table_merge_across_pages: bool = False
    schema_version: str = "guided-mineru-v1"

    @property
    def sha256(self) -> str:
        return canonical_json_hash(asdict(self))


@dataclass(frozen=True)
class ChunkingConfig:
    version: str = "section-page-v1"
    target_characters: int = 3000
    maximum_characters: int = 4200
    maximum_pages: int = 2

    @property
    def sha256(self) -> str:
        return canonical_json_hash(asdict(self))
