from __future__ import annotations

from pathlib import Path
from typing import Protocol

from ..models import ExtractionResult, SourceFile


class ExtractionError(RuntimeError):
    def __init__(self, code: str, safe_message: str):
        super().__init__(safe_message)
        self.code = code
        self.safe_message = safe_message


class ExtractionProvider(Protocol):
    name: str

    def extract(self, source: SourceFile, output_dir: Path) -> ExtractionResult: ...
