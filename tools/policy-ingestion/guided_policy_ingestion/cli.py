from __future__ import annotations

import argparse
import json
import os
import sys
import uuid
from pathlib import Path

from .checkpoints import CheckpointStore, atomic_json
from .collections import CANONICAL_COLLECTIONS
from .config import ChunkingConfig, ExtractionConfig, default_work_dir
from .connection_guard import require_approved_production_connection
from .embeddings.base import EmbeddingBatchSummary
from .embeddings.data_controls import require_approved_openai_data_controls
from .embeddings.openai import OpenAIEmbeddingProvider
from .embeddings.pipeline import EmbeddingPipeline
from .embeddings.supabase import SupabaseEmbeddingRepository
from .extractors.mineru import MinerUProvider
from .importers.supabase import ImportErrorSafe, SupabaseImporter
from .pipeline import IngestionPipeline
from .registration import (
    PolicyRegistrar,
    RegistrationErrorSafe,
    RegistrationSummary,
    RightsAttestation,
    load_manifests,
    with_byte_sizes,
)


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Local Guided Operations policy ingestion")
    subcommands = parser.add_subparsers(dest="command", required=True)
    ingest = subcommands.add_parser("ingest", help="Discover, extract, validate, chunk, and optionally import policies")
    ingest.add_argument("root", type=Path, help="Root containing the three canonical collection folders")
    ingest.add_argument("--collection", choices=CANONICAL_COLLECTIONS)
    ingest.add_argument("--resume", action="store_true")
    ingest.add_argument("--force", action="store_true")
    ingest.add_argument("--dry-run", action="store_true")
    ingest.add_argument("--limit", type=int)
    ingest.add_argument("--validate-only", action="store_true")
    ingest.add_argument("--source-sha", help="Process one already-discovered source SHA-256")
    ingest.add_argument("--work-dir", type=Path, default=default_work_dir())
    ingest.add_argument("--mineru-executable", default="mineru")
    ingest.add_argument(
        "--mineru-backend",
        choices=("auto", "pipeline", "hybrid-engine", "vlm-engine"),
        default="auto",
    )
    ingest.add_argument("--import-supabase", action="store_true")
    ingest.add_argument(
        "--import-only",
        action="store_true",
        help="Import already-extracted bundles without re-running the extractor",
    )
    ingest.add_argument("--target-environment", choices=("local", "production"), default="local")
    ingest.add_argument("--source-data", choices=("fictional", "controlled-policy"), default="controlled-policy")
    ingest.add_argument("--confirm-controlled-production-import", action="store_true")

    register = subcommands.add_parser(
        "register",
        help="Create the policy document and version identities the importer requires",
    )
    register.add_argument("--work-dir", type=Path, default=default_work_dir())
    register.add_argument("--collection", choices=CANONICAL_COLLECTIONS)
    register.add_argument(
        "--source-root",
        type=Path,
        help="Optional original source folder, used only to record byte sizes",
    )
    register.add_argument(
        "--version-label",
        required=True,
        help="Label for this corpus edition, for example the assembly date",
    )
    register.add_argument(
        "--rights-evidence-ref",
        required=True,
        help="Safe reference for the rights decision; never a secret or policy text",
    )
    register.add_argument(
        "--rights-status",
        choices=("pending", "approved_internal_search", "approved_full_reader"),
        default="approved_full_reader",
    )
    register.add_argument("--classification", choices=("public", "internal", "restricted"), default="public")
    register.add_argument("--dry-run", action="store_true")
    register.add_argument("--target-environment", choices=("local", "production"), default="local")
    register.add_argument("--source-data", choices=("fictional", "controlled-policy"), default="controlled-policy")
    register.add_argument("--confirm-controlled-production-registration", action="store_true")

    embed = subcommands.add_parser(
        "embed",
        help="Resume approved policy-chunk embeddings for one registered document version",
    )
    embed.add_argument("document_version_id", help="Registered immutable policy document-version UUID")
    embed.add_argument("--profile-key")
    embed.add_argument("--batch-size", type=int, default=16)
    embed.add_argument("--limit", type=int)
    embed.add_argument("--dry-run", action="store_true")
    embed.add_argument("--target-environment", choices=("local", "production"), default="local")
    embed.add_argument("--source-data", choices=("fictional", "controlled-policy"), default="controlled-policy")
    embed.add_argument("--confirm-controlled-production-embedding", action="store_true")
    return parser


def _importer(args: argparse.Namespace, tool_root: Path) -> SupabaseImporter | None:
    if not args.import_supabase:
        return None
    if args.source_data == "controlled-policy" and (
        args.target_environment != "production" or not args.confirm_controlled_production_import
    ):
        raise ImportErrorSafe(
            "Controlled policy data may only be imported to Production with the explicit confirmation option"
        )
    database_url = os.environ.get("SUPABASE_DB_URL", "")
    facility_id = os.environ.get("GUIDED_OPERATIONS_FACILITY_ID", "")
    if not database_url or not facility_id:
        raise ImportErrorSafe("SUPABASE_DB_URL and GUIDED_OPERATIONS_FACILITY_ID are required for import")
    if args.source_data == "controlled-policy":
        require_approved_production_connection(
            database_url,
            os.environ.get("SUPABASE_PROJECT_REF", ""),
        )
    repository_root = tool_root.parent.parent
    return SupabaseImporter(database_url, facility_id, args.target_environment, repository_root, tool_root)


def _required_environment(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise ImportErrorSafe(f"{name} is required")
    return value


def _run_embedding(args: argparse.Namespace) -> EmbeddingBatchSummary:
    try:
        document_version_id = str(uuid.UUID(args.document_version_id))
    except ValueError as error:
        raise ImportErrorSafe("A valid document-version UUID is required") from error
    if args.batch_size < 1 or args.batch_size > 64:
        raise ImportErrorSafe("--batch-size must be between 1 and 64")
    if args.limit is not None and args.limit < 1:
        raise ImportErrorSafe("--limit must be at least 1")
    if args.source_data == "controlled-policy" and (
        args.target_environment != "production" or not args.confirm_controlled_production_embedding
    ):
        raise ImportErrorSafe(
            "Controlled policy embeddings require Production and the explicit confirmation option"
        )

    try:
        require_approved_openai_data_controls(os.environ)
    except ValueError as error:
        raise ImportErrorSafe("Approved OpenAI data controls are required for embeddings") from error

    database_url = _required_environment("SUPABASE_DB_URL")
    facility_id = _required_environment("GUIDED_OPERATIONS_FACILITY_ID")
    if args.source_data == "controlled-policy":
        require_approved_production_connection(
            database_url,
            os.environ.get("SUPABASE_PROJECT_REF", ""),
        )
    try:
        dimensions = int(_required_environment("OPENAI_EMBEDDING_DIMENSIONS"))
    except ValueError as error:
        raise ImportErrorSafe("OPENAI_EMBEDDING_DIMENSIONS must be an integer") from error
    profile_key = args.profile_key or _required_environment("POLICY_EMBEDDING_PROFILE_KEY")
    provider = OpenAIEmbeddingProvider(
        _required_environment("OPENAI_API_KEY"),
        _required_environment("OPENAI_EMBEDDING_MODEL"),
        dimensions,
    )
    repository = SupabaseEmbeddingRepository(
        database_url,
        facility_id,
        args.target_environment,
    )
    try:
        if args.dry_run:
            repository.require_profile(
                EmbeddingPipeline(repository, provider, profile_key).profile
            )
            eligible, existing = repository.count_eligible(document_version_id, profile_key)
            return EmbeddingBatchSummary(
                document_version_id=document_version_id,
                profile_key=profile_key,
                eligible=eligible,
                embedded=0,
                skipped_existing=existing,
                remaining=max(0, eligible - existing),
            )
        return EmbeddingPipeline(
            repository,
            provider,
            profile_key,
            batch_size=args.batch_size,
        ).run(document_version_id, limit=args.limit)
    except (ValueError, RuntimeError) as error:
        raise ImportErrorSafe("Embedding failed; private details were not printed") from error


def _run_registration(args: argparse.Namespace) -> RegistrationSummary:
    if args.source_data == "controlled-policy" and not args.dry_run and (
        args.target_environment != "production"
        or not args.confirm_controlled_production_registration
    ):
        raise RegistrationErrorSafe(
            "Controlled policy data may only be registered in Production with the explicit confirmation option"
        )
    sources = with_byte_sizes(
        load_manifests(args.work_dir, args.collection),
        args.source_root,
    )
    if not sources:
        raise RegistrationErrorSafe("No extracted sources were found to register")
    if args.dry_run:
        return PolicyRegistrar("", "", args.target_environment).register(
            sources,
            RightsAttestation(
                reviewer_staff_member_id="00000000-0000-0000-0000-000000000000",
                evidence_ref=args.rights_evidence_ref,
                rights_status=args.rights_status,
                external_ai_allowed=args.rights_status != "pending",
                classification=args.classification,
            ),
            args.version_label,
            dry_run=True,
        )

    database_url = _required_environment("SUPABASE_DB_URL")
    facility_id = _required_environment("GUIDED_OPERATIONS_FACILITY_ID")
    reviewer = _required_environment("GUIDED_OPERATIONS_RIGHTS_REVIEWER_ID")
    if args.source_data == "controlled-policy":
        require_approved_production_connection(
            database_url,
            os.environ.get("SUPABASE_PROJECT_REF", ""),
        )
    return PolicyRegistrar(
        database_url,
        facility_id,
        args.target_environment,
        os.environ.get("SUPABASE_DB_ROOT_CERT"),
    ).register(
        sources,
        RightsAttestation(
            reviewer_staff_member_id=reviewer,
            evidence_ref=args.rights_evidence_ref,
            rights_status=args.rights_status,
            external_ai_allowed=args.rights_status != "pending",
            classification=args.classification,
        ),
        args.version_label,
    )


def main(argv: list[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    if args.command == "register":
        try:
            summary = _run_registration(args)
            print(json.dumps(summary.__dict__, indent=2, sort_keys=True))
            return 0
        except (RegistrationErrorSafe, ImportErrorSafe, ValueError) as error:
            print(str(error), file=sys.stderr)
            return 2
    if args.command == "embed":
        try:
            summary = _run_embedding(args)
            print(json.dumps(summary.__dict__, indent=2, sort_keys=True))
            return 0
        except ImportErrorSafe as error:
            print(str(error), file=sys.stderr)
            return 2
    if args.limit is not None and args.limit < 1:
        print("--limit must be at least 1", file=sys.stderr)
        return 2
    if args.import_only and not args.import_supabase:
        print("--import-only has nothing to do without --import-supabase", file=sys.stderr)
        return 2
    if args.import_only:
        # Locating the existing attempt is exactly what resume does; without it
        # the planner would open a fresh attempt directory with no bundle in it.
        args.resume = True
    tool_root = Path(__file__).resolve().parent.parent
    try:
        extraction = ExtractionConfig(backend=args.mineru_backend)
        pipeline = IngestionPipeline(
            MinerUProvider(args.mineru_executable, args.mineru_backend, extraction.provider_version),
            CheckpointStore(args.work_dir),
            extraction,
            ChunkingConfig(),
            importer=_importer(args, tool_root),
        )
        summary = pipeline.run(
            args.root,
            collection=args.collection,
            resume=args.resume,
            force=args.force,
            dry_run=args.dry_run,
            limit=args.limit,
            validate_only=args.validate_only,
            import_only=args.import_only,
            source_sha=args.source_sha,
        )
        report_path = args.work_dir.resolve() / "batch-report.json"
        atomic_json(report_path, summary.__dict__)
        print(json.dumps(summary.__dict__, indent=2, sort_keys=True))
        print(f"Batch report: {report_path}")
        return 1 if summary.failed else 0
    except (FileNotFoundError, ValueError, ImportErrorSafe) as error:
        print(str(error), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
