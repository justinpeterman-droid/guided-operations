from __future__ import annotations

import json
import os
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

from .collections import COLLECTION_SLUGS
from .models import SourceFile


def _timestamp() -> str:
    return datetime.now(UTC).isoformat()


def atomic_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(payload, indent=2, sort_keys=True, ensure_ascii=False), encoding="utf-8")
    os.replace(temporary, path)


@dataclass(frozen=True)
class AttemptPlan:
    directory: Path
    attempt_number: int
    skip: bool
    resumes_attempt: int | None


class CheckpointStore:
    def __init__(self, work_dir: Path):
        self.work_dir = work_dir.resolve()

    def identity_dir(self, source: SourceFile, configuration_hash: str) -> Path:
        return (
            self.work_dir
            / COLLECTION_SLUGS[source.collection]
            / source.sha256
            / configuration_hash
        )

    def plan(self, source: SourceFile, configuration_hash: str, resume: bool, force: bool) -> AttemptPlan:
        identity = self.identity_dir(source, configuration_hash)
        attempts = sorted(identity.glob("attempt-*")) if identity.exists() else []
        latest_number = int(attempts[-1].name.split("-")[-1]) if attempts else 0
        if attempts:
            state = self.read_state(attempts[-1])
            if not force and state.get("status") == "awaiting_review":
                return AttemptPlan(attempts[-1], latest_number, True, None)
            if resume and not force and state.get("status") in {
                "extracting",
                "validating",
                "chunking",
                "failed",
                "import_failed",
            }:
                return AttemptPlan(attempts[-1], latest_number, False, latest_number)
        next_number = latest_number + 1
        return AttemptPlan(identity / f"attempt-{next_number:04d}", next_number, False, latest_number or None)

    @staticmethod
    def read_state(attempt_dir: Path) -> dict:
        path = attempt_dir / "state.json"
        if not path.exists():
            return {}
        try:
            value = json.loads(path.read_text(encoding="utf-8"))
            return value if isinstance(value, dict) else {}
        except (OSError, UnicodeError, json.JSONDecodeError):
            return {}

    @staticmethod
    def write_state(attempt_dir: Path, **fields: object) -> None:
        current = CheckpointStore.read_state(attempt_dir)
        current.update(fields)
        current["updated_at"] = _timestamp()
        atomic_json(attempt_dir / "state.json", current)
