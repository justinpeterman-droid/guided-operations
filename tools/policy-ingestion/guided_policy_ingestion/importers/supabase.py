from __future__ import annotations

import hashlib
import os
import subprocess
import uuid
from dataclasses import asdict
from pathlib import Path

from ..config import ChunkingConfig, ExtractionConfig
from ..models import NormalizedPage, PolicyChunk, SourceFile, ValidationResult
from ..normalization import NORMALIZATION_VERSION


class ImportErrorSafe(RuntimeError):
    pass


def _git_commit(repository_root: Path) -> str:
    configured = os.environ.get("GUIDED_OPERATIONS_CODE_COMMIT_SHA", "").strip().lower()
    if len(configured) == 40 and all(character in "0123456789abcdef" for character in configured):
        return configured
    try:
        value = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            cwd=repository_root,
            capture_output=True,
            text=True,
            check=True,
        ).stdout.strip().lower()
    except (OSError, subprocess.SubprocessError) as error:
        raise ImportErrorSafe("A valid code commit SHA is required before import") from error
    if len(value) != 40:
        raise ImportErrorSafe("A valid code commit SHA is required before import")
    return value


def _dependency_hash(tool_root: Path) -> str:
    lock = tool_root / "uv.lock"
    source = lock if lock.exists() else tool_root / "pyproject.toml"
    return hashlib.sha256(source.read_bytes()).hexdigest()


class SupabaseImporter:
    def __init__(
        self,
        database_url: str,
        facility_id: str,
        environment: str,
        repository_root: Path,
        tool_root: Path,
    ):
        self.database_url = database_url
        self.facility_id = facility_id
        self.environment = environment
        self.repository_root = repository_root
        self.tool_root = tool_root

    def import_document(
        self,
        source: SourceFile,
        pages: tuple[NormalizedPage, ...],
        chunks: tuple[PolicyChunk, ...],
        validation: ValidationResult,
        extraction: ExtractionConfig,
        chunking: ChunkingConfig,
        extraction_tool: str,
        extraction_version: str,
        extraction_model_version: str | None,
        attempt_number: int,
    ) -> str:
        if validation.status != "awaiting_review":
            raise ImportErrorSafe("Only validated bundles can be imported")
        try:
            import psycopg
            from psycopg.types.json import Jsonb
        except ImportError as error:
            raise ImportErrorSafe("Install the policy-ingestion import dependency before importing") from error
        try:
            connection_options = {"sslmode": "require"} if self.environment == "production" else {}
            with psycopg.connect(self.database_url, **connection_options) as connection:
                with connection.cursor() as cursor:
                    cursor.execute(
                        """
                        select version.id, document.collection::text
                        from app_private.policy_document_versions as version
                        join app_private.policy_documents as document on document.id = version.document_id
                        where document.facility_id = %s
                          and version.source_sha256 = %s
                        """,
                        (self.facility_id, source.sha256),
                    )
                    matches = cursor.fetchall()
                    if len(matches) != 1:
                        raise ImportErrorSafe(
                            "The source must match exactly one pre-registered policy document version"
                        )
                    document_version_id, registered_collection = matches[0]
                    if registered_collection != source.collection:
                        raise ImportErrorSafe("The registered policy collection does not match the source folder")
                    cursor.execute(
                        """
                        select id from app_private.policy_ingestion_runs
                        where document_version_id = %s
                          and source_sha256 = %s
                          and extraction_config_sha256 = %s
                          and normalization_version = %s
                          and chunking_version = %s
                          and chunking_config_sha256 = %s
                          and status not in ('failed', 'quarantined', 'superseded')
                        limit 1
                        """,
                        (
                            document_version_id,
                            source.sha256,
                            extraction.sha256,
                            NORMALIZATION_VERSION,
                            chunking.version,
                            chunking.sha256,
                        ),
                    )
                    existing = cursor.fetchone()
                    if existing:
                        return str(existing[0])
                    run_id = uuid.uuid4()
                    cursor.execute(
                        """
                        insert into app_private.policy_ingestion_runs (
                          id, document_version_id, environment, source_sha256,
                          collection, source_filename, extraction_provider,
                          extraction_tool, extraction_version, extraction_model_version,
                          extraction_config_sha256, ocr_engine, ocr_version, ocr_language,
                          ocr_config_sha256, ocr_configuration, normalization_version,
                          chunking_version, chunking_config_sha256, chunking_configuration,
                          code_commit_sha, dependency_lock_sha256, status, qa_status,
                          attempt_number, last_completed_stage, last_checkpoint_at,
                          page_count, chunk_count, warning_count, failure_count, completed_at
                        ) values (
                          %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                          %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                          %s, %s, 'awaiting_review', 'pending', %s,
                          'awaiting_review', statement_timestamp(), %s, %s, %s, 0,
                          statement_timestamp()
                        )
                        """,
                        (
                            run_id,
                            document_version_id,
                            self.environment,
                            source.sha256,
                            source.collection,
                            source.filename,
                            extraction.provider,
                            extraction_tool,
                            extraction_version,
                            extraction_model_version,
                            extraction.sha256,
                            "mineru",
                            extraction_version,
                            extraction.ocr_language,
                            extraction.sha256,
                            Jsonb(asdict(extraction)),
                            NORMALIZATION_VERSION,
                            chunking.version,
                            chunking.sha256,
                            Jsonb(asdict(chunking)),
                            _git_commit(self.repository_root),
                            _dependency_hash(self.tool_root),
                            attempt_number,
                            len(pages),
                            len(chunks),
                            len(validation.warnings),
                        ),
                    )
                    for page in pages:
                        cursor.execute(
                            """
                            insert into app_private.policy_pages (
                              document_version_id, ingestion_run_id, source_page_index,
                              printed_page_label, normalized_text, normalized_text_sha256,
                              extraction_mode, ocr_confidence, quality_flags,
                              structured_layout_ref, extraction_warning, review_status,
                              heading, section_path, warning_codes, layout_metadata_sha256
                            ) values (
                              %s, %s, %s, %s, %s, %s, %s, %s, %s,
                              %s, %s, 'pending', %s, %s, %s, %s
                            )
                            """,
                            (
                                document_version_id,
                                run_id,
                                page.source_page_index,
                                page.printed_page_label,
                                page.normalized_text,
                                page.normalized_text_sha256,
                                page.extraction_mode,
                                page.ocr_confidence,
                                list(page.quality_flags),
                                page.structured_layout_ref,
                                page.extraction_warning,
                                page.heading,
                                page.section_path,
                                list(page.warning_codes),
                                page.layout_metadata_sha256,
                            ),
                        )
                    for chunk in chunks:
                        cursor.execute(
                            """
                            insert into app_private.policy_chunks (
                              id, document_version_id, ingestion_run_id, ordinal,
                              page_start, page_end, printed_page_start, printed_page_end,
                              section_path, content, content_sha256, token_count,
                              overlap_token_count, lifecycle_status, qa_approved
                            ) values (
                              %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                              0, 'pending', false
                            )
                            """,
                            (
                                chunk.id,
                                document_version_id,
                                run_id,
                                chunk.ordinal,
                                chunk.page_start,
                                chunk.page_end,
                                chunk.printed_page_start,
                                chunk.printed_page_end,
                                chunk.section_path,
                                chunk.content,
                                chunk.content_sha256,
                                chunk.token_count,
                            ),
                        )
                connection.commit()
            return str(run_id)
        except ImportErrorSafe:
            raise
        except Exception as error:
            raise ImportErrorSafe("Supabase import failed; private details were not printed") from error
