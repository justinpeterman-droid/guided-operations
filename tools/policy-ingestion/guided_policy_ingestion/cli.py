from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

from .checkpoints import CheckpointStore, atomic_json
from .collections import CANONICAL_COLLECTIONS
from .config import ChunkingConfig, ExtractionConfig, default_work_dir
from .connection_guard import require_approved_production_connection
from .extractors.mineru import MinerUProvider
from .importers.supabase import ImportErrorSafe, SupabaseImporter
from .pipeline import IngestionPipeline


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
    ingest.add_argument("--target-environment", choices=("local", "production"), default="local")
    ingest.add_argument("--source-data", choices=("fictional", "controlled-policy"), default="controlled-policy")
    ingest.add_argument("--confirm-controlled-production-import", action="store_true")
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


def main(argv: list[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    if args.limit is not None and args.limit < 1:
        print("--limit must be at least 1", file=sys.stderr)
        return 2
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
