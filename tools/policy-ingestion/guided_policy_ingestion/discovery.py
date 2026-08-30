from __future__ import annotations

import hashlib
import mimetypes
from pathlib import Path

from .collections import CANONICAL_COLLECTIONS, canonical_collection
from .models import SourceFile

SUPPORTED_EXTENSIONS = {
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".bmp": "image/bmp",
    ".jpeg": "image/jpeg",
    ".jpg": "image/jpeg",
    ".png": "image/png",
    ".tif": "image/tiff",
    ".tiff": "image/tiff",
    ".webp": "image/webp",
}


def sha256_file(path: Path, block_size: int = 1024 * 1024) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while block := handle.read(block_size):
            digest.update(block)
    return digest.hexdigest()


def _source(root: Path, path: Path, collection: str) -> SourceFile:
    relative = path.resolve().relative_to(root.resolve())
    media_type = SUPPORTED_EXTENSIONS.get(path.suffix.lower())
    if not media_type:
        media_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    return SourceFile(
        path=path.resolve(),
        collection=collection,
        relative_path=relative.as_posix(),
        filename=path.name,
        sha256=sha256_file(path),
        media_type=media_type,
        size_bytes=path.stat().st_size,
    )


def discover_sources(
    root: Path,
    collection: str | None = None,
    source_sha: str | None = None,
) -> list[SourceFile]:
    root = root.resolve()
    if not root.is_dir():
        raise FileNotFoundError("The policy source root is not a directory")
    selected = (canonical_collection(collection),) if collection else CANONICAL_COLLECTIONS
    discovered: list[SourceFile] = []
    for collection_name in selected:
        collection_dir = root / collection_name
        if not collection_dir.is_dir():
            raise FileNotFoundError(f"Required collection folder is missing: {collection_name}")
        paths = sorted(
            (
                candidate
                for candidate in collection_dir.rglob("*")
                if candidate.is_file()
                and not candidate.is_symlink()
                and candidate.suffix.lower() in SUPPORTED_EXTENSIONS
            ),
            key=lambda item: item.relative_to(root).as_posix().casefold(),
        )
        for path in paths:
            source = _source(root, path, collection_name)
            if source_sha is None or source.sha256 == source_sha:
                discovered.append(source)
    return discovered
