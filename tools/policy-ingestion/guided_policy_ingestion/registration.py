"""Register extracted policies as documents and immutable versions.

The importer refuses any source that is not already present as exactly one
`policy_document_version`, so extraction alone can never reach the database.
That guard is deliberate: it stops a file being imported under the wrong
identity or the wrong collection. Registration is the separate, owner-driven
step that creates those identities, and it is also where the rights
attestation is recorded, because the database enforces that nothing can reach
an AI provider unless a named reviewer approved it on a date with evidence.

Nothing here reads or logs policy text. It works from the extraction
manifests, which carry only hashes, counts, filenames and collections.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path

from .collections import COLLECTION_SLUGS, canonical_collection
from .diagnostics import safe_database_detail as _safe_database_detail

# The corpus is replaced by hand once a year (O-026), so a review that is
# current for a year matches the real refresh cycle rather than inventing one.
RIGHTS_REVIEW_PERIOD = timedelta(days=365)

_MEDIA_EXTENSIONS = {"application/pdf": "pdf", "text/plain": "txt"}

# app_private.policy_documents.stable_key is checked against this exact shape.
_STABLE_KEY = re.compile(r"^[a-z0-9][a-z0-9_-]{1,127}$")


class RegistrationErrorSafe(RuntimeError):
    """Raised with a message that is safe to print. Never carries policy text."""


@dataclass(frozen=True)
class PolicySource:
    """One extracted document, as described by its manifest."""

    source_sha256: str
    collection: str
    source_filename: str
    media_type: str
    page_count: int | None
    byte_size: int | None = None

    @property
    def storage_path(self) -> str:
        """Content-addressed, so the path cannot collide or leak a filename."""
        extension = _MEDIA_EXTENSIONS.get(self.media_type, "bin")
        return f"{COLLECTION_SLUGS[self.collection]}/{self.source_sha256}.{extension}"


@dataclass
class RegistrationSummary:
    """Counts only. Safe to print and to keep in an operations record."""

    discovered: int = 0
    registered: int = 0
    already_registered: int = 0
    collections: dict[str, int] = field(default_factory=dict)


def slugify(value: str) -> str:
    """Fold a filename into the stable-key alphabet the database accepts."""
    folded = unicodedata.normalize("NFKD", value)
    folded = folded.encode("ascii", "ignore").decode("ascii").lower()
    folded = re.sub(r"[^a-z0-9]+", "-", folded).strip("-")
    return folded[:128]


def stable_keys_for(sources: tuple[PolicySource, ...]) -> dict[str, str]:
    """Map each source hash to a unique, deterministic stable key.

    Readable keys are worth having, but two policies can share a slug once
    punctuation is stripped. Rather than make every key ugly to defend against
    the few that clash, only the clashing ones take a hash suffix.
    """
    proposed: dict[str, str] = {}
    for source in sources:
        stem = Path(source.source_filename).stem
        slug = slugify(stem) or f"policy-{source.source_sha256[:12]}"
        if len(slug) < 2:
            slug = f"policy-{source.source_sha256[:12]}"
        proposed[source.source_sha256] = slug

    counts: dict[str, int] = {}
    for slug in proposed.values():
        counts[slug] = counts.get(slug, 0) + 1

    resolved: dict[str, str] = {}
    for source_sha256, slug in proposed.items():
        if counts[slug] > 1:
            slug = f"{slug[:119]}-{source_sha256[:8]}"
        if not _STABLE_KEY.match(slug):
            slug = f"policy-{source_sha256[:12]}"
        resolved[source_sha256] = slug
    return resolved


def load_manifests(work_dir: Path, collection: str | None = None) -> tuple[PolicySource, ...]:
    """Read every extraction manifest under a work directory.

    A manifest exists only for a source that finished extraction, so this
    reports exactly what is available to register - not what was discovered.
    """
    import json

    if not work_dir.exists():
        raise RegistrationErrorSafe("The extraction work directory does not exist")

    slugs = (
        [COLLECTION_SLUGS[canonical_collection(collection)]]
        if collection
        else list(COLLECTION_SLUGS.values())
    )

    sources: dict[str, PolicySource] = {}
    for slug in slugs:
        for manifest_path in sorted((work_dir / slug).rglob("manifest.json")):
            try:
                manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            except (OSError, ValueError) as error:
                raise RegistrationErrorSafe("An extraction manifest could not be read") from error
            source_sha256 = str(manifest.get("source_sha256", ""))
            if len(source_sha256) != 64:
                raise RegistrationErrorSafe("An extraction manifest has no usable source hash")
            # A re-extraction writes a second attempt for the same source. The
            # identity being registered is the source, not the attempt, so the
            # first manifest seen for a hash is enough.
            if source_sha256 in sources:
                continue
            sources[source_sha256] = PolicySource(
                source_sha256=source_sha256,
                collection=canonical_collection(str(manifest.get("collection", ""))),
                source_filename=str(manifest.get("source_filename", "")),
                media_type=str(manifest.get("media_type", "")),
                page_count=manifest.get("page_count"),
            )
    return tuple(sources[key] for key in sorted(sources))


def with_byte_sizes(
    sources: tuple[PolicySource, ...],
    source_root: Path | None,
) -> tuple[PolicySource, ...]:
    """Fill byte sizes from the original files when the operator supplies them.

    byte_size is nullable, so a missing source folder degrades to null rather
    than failing the run.
    """
    if source_root is None or not source_root.exists():
        return sources
    by_name: dict[str, int] = {}
    for path in source_root.rglob("*"):
        if path.is_file():
            by_name.setdefault(path.name, path.stat().st_size)
    return tuple(
        PolicySource(
            source_sha256=source.source_sha256,
            collection=source.collection,
            source_filename=source.source_filename,
            media_type=source.media_type,
            page_count=source.page_count,
            byte_size=by_name.get(source.source_filename),
        )
        for source in sources
    )


@dataclass(frozen=True)
class RightsAttestation:
    """What the owner asserts about the corpus, recorded per version.

    The database refuses `external_ai_allowed` without an approved status, a
    named reviewer, a review timestamp and a non-empty evidence reference, so
    this is not decoration - it is the record that makes embedding legal to
    attempt at all.
    """

    reviewer_staff_member_id: str
    evidence_ref: str
    rights_status: str = "approved_full_reader"
    external_ai_allowed: bool = True
    classification: str = "public"
    allowed_processing_regions: tuple[str, ...] = ("us-east-1",)

    def __post_init__(self) -> None:
        if self.rights_status not in (
            "pending",
            "approved_internal_search",
            "approved_full_reader",
        ):
            raise RegistrationErrorSafe("Unsupported rights status for registration")
        if self.rights_status == "pending" and self.external_ai_allowed:
            raise RegistrationErrorSafe(
                "External AI processing cannot be allowed while rights remain pending"
            )
        if self.rights_status != "pending" and not self.evidence_ref.strip():
            raise RegistrationErrorSafe("An approved rights status requires an evidence reference")


class PolicyRegistrar:
    """Creates the document and version identities the importer requires.

    Every source is registered in its own transaction. A partial run therefore
    leaves a consistent database and can simply be re-run: registration is
    idempotent on (facility, source hash), so re-running never duplicates a
    version or silently changes one that already exists.
    """

    def __init__(self, database_url: str, facility_id: str, environment: str):
        self.database_url = database_url
        self.facility_id = facility_id
        self.environment = environment

    def register(
        self,
        sources: tuple[PolicySource, ...],
        attestation: RightsAttestation,
        version_label: str,
        dry_run: bool = False,
    ) -> RegistrationSummary:
        summary = RegistrationSummary(discovered=len(sources))
        for source in sources:
            summary.collections[source.collection] = (
                summary.collections.get(source.collection, 0) + 1
            )
        if dry_run:
            return summary

        try:
            import psycopg
        except ImportError as error:
            raise RegistrationErrorSafe(
                "Install the policy-ingestion import dependency before registering"
            ) from error

        keys = stable_keys_for(sources)
        reviewed_at = datetime.now(timezone.utc)
        options = {"sslmode": "require"} if self.environment == "production" else {}
        try:
            with psycopg.connect(self.database_url, **options) as connection:
                for source in sources:
                    with connection.transaction():
                        with connection.cursor() as cursor:
                            if self._already_registered(cursor, source):
                                summary.already_registered += 1
                                continue
                            self._insert(
                                cursor,
                                source,
                                keys[source.source_sha256],
                                attestation,
                                version_label,
                                reviewed_at,
                            )
                            summary.registered += 1
        except RegistrationErrorSafe:
            raise
        except Exception as error:  # noqa: BLE001 - reported without row values
            raise RegistrationErrorSafe(
                f"Registration failed: {_safe_database_detail(error)}"
            ) from error
        return summary

    def _already_registered(self, cursor, source: PolicySource) -> bool:
        cursor.execute(
            """
            select version.id
            from app_private.policy_document_versions as version
            join app_private.policy_documents as document
              on document.id = version.document_id
            where document.facility_id = %s
              and version.source_sha256 = %s
            """,
            (self.facility_id, source.source_sha256),
        )
        return cursor.fetchone() is not None

    def _insert(
        self,
        cursor,
        source: PolicySource,
        stable_key: str,
        attestation: RightsAttestation,
        version_label: str,
        reviewed_at: datetime,
    ) -> None:
        title = Path(source.source_filename).stem[:300] or stable_key
        # A re-run after a partial failure can find the document already there
        # without its version, so the document insert has to tolerate that.
        cursor.execute(
            """
            insert into app_private.policy_documents (
                facility_id, stable_key, title, collection, classification, status
            ) values (%s, %s, %s, %s, %s, 'approved')
            on conflict (facility_id, stable_key) do update
                set title = excluded.title
            returning id
            """,
            (
                self.facility_id,
                stable_key,
                title,
                source.collection,
                attestation.classification,
            ),
        )
        row = cursor.fetchone()
        if row is None:
            raise RegistrationErrorSafe("The policy document identity could not be created")
        document_id = row[0]

        cursor.execute(
            """
            insert into app_private.policy_document_versions (
                document_id, version_label, source_sha256, storage_bucket,
                storage_path, media_type, page_count, source_filename, byte_size,
                rights_status, rights_evidence_ref, rights_reviewed_by,
                rights_reviewed_at, rights_review_due_at,
                allowed_processing_regions, external_ai_allowed,
                lifecycle_status, is_current
            ) values (
                %s, %s, %s, 'policy-sources',
                %s, %s, %s, %s, %s,
                %s, %s, %s,
                %s, %s,
                %s, %s,
                'active', true
            )
            """,
            (
                document_id,
                version_label,
                source.source_sha256,
                source.storage_path,
                source.media_type,
                source.page_count,
                source.source_filename[:1024],
                source.byte_size,
                attestation.rights_status,
                attestation.evidence_ref,
                attestation.reviewer_staff_member_id,
                reviewed_at,
                reviewed_at + RIGHTS_REVIEW_PERIOD,
                list(attestation.allowed_processing_regions),
                attestation.external_ai_allowed,
            ),
        )
