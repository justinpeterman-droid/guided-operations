from __future__ import annotations

from pathlib import Path

CANONICAL_COLLECTIONS = (
    "BMU policies",
    "BMU Post Orders",
    "SD",
)

COLLECTION_SLUGS = {
    "BMU policies": "bmu-policies",
    "BMU Post Orders": "bmu-post-orders",
    "SD": "sd",
}


def canonical_collection(value: str) -> str:
    if value not in CANONICAL_COLLECTIONS:
        allowed = ", ".join(CANONICAL_COLLECTIONS)
        raise ValueError(f"Unknown collection. Expected one of: {allowed}")
    return value


def collection_for_path(root: Path, path: Path) -> str:
    relative = path.resolve().relative_to(root.resolve())
    if not relative.parts:
        raise ValueError("A source file must be inside a canonical collection folder")
    return canonical_collection(relative.parts[0])
