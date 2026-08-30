from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from pathlib import Path

from .checkpoints import CheckpointStore, atomic_json
from .chunking import chunk_pages
from .config import ChunkingConfig, ExtractionConfig, canonical_json_hash
from .discovery import discover_sources
from .extractors.base import ExtractionError, ExtractionProvider
from .importers.supabase import ImportErrorSafe, SupabaseImporter
from .models import NormalizedPage, PolicyChunk, SourceFile, ValidationResult, jsonable
from .normalization import NORMALIZATION_VERSION, normalize_extraction
from .validation import validate_document


@dataclass
class BatchSummary:
    total_files_discovered: int = 0
    processed: int = 0
    skipped_unchanged: int = 0
    succeeded: int = 0
    awaiting_review: int = 0
    failed: int = 0
    total_pages: int = 0
    total_chunks: int = 0
    collections: dict[str, dict[str, int]] = field(default_factory=dict)
    # Distinct safe failure reasons with how many sources hit each. A count of
    # failures with no reason attached tells the operator nothing actionable.
    failure_reasons: dict[str, int] = field(default_factory=dict)

    def note_failure(self, reason: str) -> None:
        self.failure_reasons[reason] = self.failure_reasons.get(reason, 0) + 1

    def count(self, collection: str, key: str, amount: int = 1) -> None:
        bucket = self.collections.setdefault(
            collection,
            {"discovered": 0, "processed": 0, "skipped": 0, "awaiting_review": 0, "failed": 0, "pages": 0, "chunks": 0},
        )
        bucket[key] += amount


def _safe_pipeline_reason(error: BaseException) -> str:
    """Name a pipeline failure without printing a source path.

    OSError carries the filename it choked on, and the tool must not log
    absolute source paths, so only its errno is reported. The remaining types
    raise messages this code or a parser wrote, which name structure rather
    than content.
    """
    name = type(error).__name__
    if isinstance(error, OSError):
        return f"{name}; errno {error.errno}"
    detail = str(error).strip().splitlines()[0] if str(error).strip() else ""
    return f"{name}: {detail[:200]}" if detail else name


def _load_bundle(attempt_dir: Path) -> tuple[tuple[NormalizedPage, ...], tuple[PolicyChunk, ...]]:
    pages_payload = json.loads((attempt_dir / "pages.json").read_text(encoding="utf-8"))
    chunks_payload = json.loads((attempt_dir / "chunks.json").read_text(encoding="utf-8"))
    pages = tuple(NormalizedPage(**page) for page in pages_payload)
    chunks = tuple(PolicyChunk(**chunk) for chunk in chunks_payload)
    return pages, chunks


class IngestionPipeline:
    def __init__(
        self,
        provider: ExtractionProvider,
        checkpoint_store: CheckpointStore,
        extraction_config: ExtractionConfig,
        chunking_config: ChunkingConfig,
        importer: SupabaseImporter | None = None,
    ):
        self.provider = provider
        self.checkpoints = checkpoint_store
        self.extraction_config = extraction_config
        self.chunking_config = chunking_config
        self.importer = importer
        self.configuration_hash = canonical_json_hash(
            {
                "extraction": asdict(extraction_config),
                "normalization_version": NORMALIZATION_VERSION,
                "chunking": asdict(chunking_config),
            }
        )

    def run(
        self,
        root: Path,
        collection: str | None = None,
        resume: bool = False,
        force: bool = False,
        dry_run: bool = False,
        limit: int | None = None,
        validate_only: bool = False,
        import_only: bool = False,
        source_sha: str | None = None,
    ) -> BatchSummary:
        """Run the pipeline.

        `import_only` covers the case where extraction finished in an earlier
        session and the documents were registered afterwards. Without it the
        only way to import an already-extracted corpus is `--force`, which
        re-runs the extractor over every file - hours of work to reproduce
        bundles that are already on disk and already validated.
        """
        sources = discover_sources(root, collection=collection, source_sha=source_sha)
        if limit is not None:
            sources = sources[:limit]
        summary = BatchSummary(total_files_discovered=len(sources))
        for source in sources:
            summary.count(source.collection, "discovered")
            if dry_run:
                continue
            plan = self.checkpoints.plan(source, self.configuration_hash, resume=resume, force=force)
            if plan.skip and not validate_only and not import_only:
                summary.skipped_unchanged += 1
                summary.count(source.collection, "skipped")
                continue
            summary.processed += 1
            summary.count(source.collection, "processed")
            plan.directory.mkdir(parents=True, exist_ok=True)
            try:
                prior_state = self.checkpoints.read_state(plan.directory)
                reuse_bundle = (
                    validate_only
                    or import_only
                    or (resume and prior_state.get("status") == "import_failed")
                )
                if reuse_bundle:
                    pages, chunks = _load_bundle(plan.directory)
                    expected_page_count = len(pages)
                    manifest = json.loads(
                        (plan.directory / "manifest.json").read_text(encoding="utf-8")
                    )
                    extraction_tool = str(manifest.get("extraction_tool", "existing-bundle"))
                    extraction_version = str(
                        manifest.get("extraction_version", self.extraction_config.provider_version)
                    )
                    extraction_model_version = manifest.get("extraction_model_version")
                else:
                    self.checkpoints.write_state(
                        plan.directory,
                        status="extracting",
                        source_sha256=source.sha256,
                        collection=source.collection,
                        configuration_sha256=self.configuration_hash,
                        attempt_number=plan.attempt_number,
                        resumes_attempt=plan.resumes_attempt,
                    )
                    extraction = self.provider.extract(source, plan.directory / "extraction")
                    pages = normalize_extraction(source, extraction)
                    self.checkpoints.write_state(plan.directory, status="chunking", page_count=len(pages))
                    chunks = chunk_pages(
                        source,
                        pages,
                        self.chunking_config,
                        self.extraction_config.sha256,
                    )
                    expected_page_count = extraction.page_count
                    extraction_tool = extraction.extraction_tool
                    extraction_version = extraction.extraction_version
                    extraction_model_version = extraction.extraction_model_version
                    atomic_json(plan.directory / "pages.json", jsonable(pages))
                    atomic_json(plan.directory / "chunks.json", jsonable(chunks))
                    atomic_json(
                        plan.directory / "manifest.json",
                        {
                            "source_filename": source.filename,
                            "source_relative_path": source.relative_path,
                            "source_sha256": source.sha256,
                            "collection": source.collection,
                            "media_type": source.media_type,
                            "extraction_provider": self.extraction_config.provider,
                            "extraction_tool": extraction_tool,
                            "extraction_version": extraction_version,
                            "extraction_model_version": extraction_model_version,
                            "extraction_config_sha256": self.extraction_config.sha256,
                            "normalization_version": NORMALIZATION_VERSION,
                            "chunking_version": self.chunking_config.version,
                            "chunking_config_sha256": self.chunking_config.sha256,
                            "configuration_sha256": self.configuration_hash,
                            "page_count": len(pages),
                            "chunk_count": len(chunks),
                        },
                    )
                self.checkpoints.write_state(plan.directory, status="validating")
                validation = validate_document(
                    source,
                    pages,
                    chunks,
                    self.chunking_config,
                    expected_page_count=expected_page_count,
                )
                atomic_json(plan.directory / "validation.json", jsonable(validation))
                if validation.status == "failed":
                    summary.failed += 1
                    summary.count(source.collection, "failed")
                    self.checkpoints.write_state(
                        plan.directory,
                        status="failed",
                        failure_code="validation_failed",
                        failure_count=len(validation.errors),
                    )
                    continue
                run_id = None
                if self.importer:
                    try:
                        run_id = self.importer.import_document(
                            source,
                            pages,
                            chunks,
                            validation,
                            self.extraction_config,
                            self.chunking_config,
                            extraction_tool,
                            extraction_version,
                            extraction_model_version,
                            plan.attempt_number,
                        )
                    except ImportErrorSafe as error:
                        # ImportErrorSafe messages are written to be printable -
                        # that is the whole point of the type - so recording and
                        # showing one costs nothing and saves the operator from
                        # a failure count with no cause attached.
                        reason = str(error)
                        self.checkpoints.write_state(
                            plan.directory,
                            status="import_failed",
                            failure_code="supabase_import_failed",
                            failure_reason=reason,
                            page_count=len(pages),
                            chunk_count=len(chunks),
                        )
                        summary.note_failure(reason)
                        summary.failed += 1
                        summary.count(source.collection, "failed")
                        continue
                self.checkpoints.write_state(
                    plan.directory,
                    status="awaiting_review",
                    page_count=len(pages),
                    chunk_count=len(chunks),
                    warning_count=len(validation.warnings),
                    imported_run_id=run_id,
                )
                summary.succeeded += 1
                summary.awaiting_review += 1
                summary.total_pages += len(pages)
                summary.total_chunks += len(chunks)
                summary.count(source.collection, "awaiting_review")
                summary.count(source.collection, "pages", len(pages))
                summary.count(source.collection, "chunks", len(chunks))
            except (ExtractionError, OSError, ValueError, json.JSONDecodeError) as error:
                code = error.code if isinstance(error, ExtractionError) else "pipeline_failed"
                reason = _safe_pipeline_reason(error)
                self.checkpoints.write_state(
                    plan.directory,
                    status="failed",
                    failure_code=code,
                    failure_reason=reason,
                )
                summary.note_failure(reason)
                summary.failed += 1
                summary.count(source.collection, "failed")
        return summary
