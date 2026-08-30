from __future__ import annotations

from contextlib import contextmanager

from .base import EmbeddingChunk, EmbeddingProfile


class SupabaseEmbeddingRepository:
    def __init__(self, database_url: str, facility_id: str, environment: str):
        self.database_url = database_url
        self.facility_id = facility_id
        self.environment = environment

    def _connect(self):
        try:
            import psycopg
        except ImportError as error:
            raise RuntimeError("Install the policy-ingestion import dependency before embedding") from error
        options = {"sslmode": "require"} if self.environment == "production" else {}
        return psycopg.connect(self.database_url, **options)

    def require_profile(self, profile: EmbeddingProfile) -> None:
        with self._connect() as connection, connection.cursor() as cursor:
            cursor.execute(
                """
                select provider, model, dimensions
                from app_private.embedding_profiles
                where profile_key = %s
                """,
                (profile.profile_key,),
            )
            row = cursor.fetchone()
        if row != (profile.provider, profile.model, profile.dimensions):
            raise RuntimeError("The registered embedding profile does not match the provider configuration")

    def _eligible_where(self) -> str:
        return """
          document.facility_id = %s
          and version.id = %s
          and document.status = 'approved'
          and version.approved_at is not null
          and version.indexed_at is not null
          and version.lifecycle_status = 'active'
          and version.is_current
          and version.rights_status in ('approved_internal_search', 'approved_full_reader')
          and version.external_ai_allowed
          and (version.rights_review_due_at is null or version.rights_review_due_at > statement_timestamp())
          and ingestion.status = 'ready'
          and ingestion.qa_status = 'approved'
          and ingestion.source_sha256 = version.source_sha256
          and ingestion.collection = document.collection
          and app_private.policy_chunk_pages_are_approved(
            chunk.ingestion_run_id,
            chunk.page_start,
            chunk.page_end
          )
          and chunk.lifecycle_status = 'active'
          and chunk.qa_approved
        """

    def count_eligible(self, document_version_id: str, profile_key: str) -> tuple[int, int]:
        with self._connect() as connection, connection.cursor() as cursor:
            cursor.execute(
                f"""
                select
                  count(*)::integer,
                  count(chunk_embedding.policy_chunk_id)::integer
                from app_private.policy_chunks as chunk
                join app_private.policy_ingestion_runs as ingestion
                  on ingestion.id = chunk.ingestion_run_id
                  and ingestion.document_version_id = chunk.document_version_id
                join app_private.policy_document_versions as version
                  on version.id = chunk.document_version_id
                join app_private.policy_documents as document
                  on document.id = version.document_id
                left join app_private.policy_chunk_embeddings as chunk_embedding
                  on chunk_embedding.policy_chunk_id = chunk.id
                  and chunk_embedding.profile_key = %s
                where {self._eligible_where()}
                """,
                (profile_key, self.facility_id, document_version_id),
            )
            row = cursor.fetchone()
        if row is None or row[0] < 1:
            raise RuntimeError("No approved chunks are eligible for embedding")
        return int(row[0]), int(row[1])

    def next_chunks(
        self,
        document_version_id: str,
        profile_key: str,
        limit: int,
    ) -> tuple[EmbeddingChunk, ...]:
        with self._connect() as connection, connection.cursor() as cursor:
            cursor.execute(
                f"""
                select chunk.id::text, chunk.content
                from app_private.policy_chunks as chunk
                join app_private.policy_ingestion_runs as ingestion
                  on ingestion.id = chunk.ingestion_run_id
                  and ingestion.document_version_id = chunk.document_version_id
                join app_private.policy_document_versions as version
                  on version.id = chunk.document_version_id
                join app_private.policy_documents as document
                  on document.id = version.document_id
                left join app_private.policy_chunk_embeddings as chunk_embedding
                  on chunk_embedding.policy_chunk_id = chunk.id
                  and chunk_embedding.profile_key = %s
                where {self._eligible_where()}
                  and chunk_embedding.policy_chunk_id is null
                order by chunk.id
                limit %s
                """,
                (profile_key, self.facility_id, document_version_id, limit),
            )
            rows = cursor.fetchall()
        return tuple(EmbeddingChunk(chunk_id=row[0], content=row[1]) for row in rows)

    @contextmanager
    def lock_eligible(
        self,
        document_version_id: str,
        profile_key: str,
        chunk_ids: tuple[str, ...],
    ):
        if not chunk_ids:
            yield False
            return
        with self._connect() as connection, connection.cursor() as cursor:
            cursor.execute(
                f"""
                select chunk.id::text
                from app_private.policy_chunks as chunk
                join app_private.policy_ingestion_runs as ingestion
                  on ingestion.id = chunk.ingestion_run_id
                  and ingestion.document_version_id = chunk.document_version_id
                join app_private.policy_document_versions as version
                  on version.id = chunk.document_version_id
                join app_private.policy_documents as document
                  on document.id = version.document_id
                where {self._eligible_where()}
                  and chunk.id = any(%s::uuid[])
                  and not exists (
                    select 1
                    from app_private.policy_chunk_embeddings as chunk_embedding
                    where chunk_embedding.policy_chunk_id = chunk.id
                      and chunk_embedding.profile_key = %s
                  )
                order by chunk.id
                for share of chunk, ingestion, version, document
                """,
                (self.facility_id, document_version_id, list(chunk_ids), profile_key),
            )
            locked_ids = {row[0] for row in cursor.fetchall()}
            yield locked_ids == set(chunk_ids) and len(locked_ids) == len(chunk_ids)

    def store(
        self,
        profile_key: str,
        chunks: tuple[EmbeddingChunk, ...],
        vectors: tuple[tuple[float, ...], ...],
    ) -> int:
        if len(chunks) != len(vectors):
            raise RuntimeError("Embedding batch size does not match its chunks")
        with self._connect() as connection, connection.cursor() as cursor:
            stored = 0
            for chunk, vector in zip(chunks, vectors, strict=True):
                cursor.execute(
                    """
                    insert into app_private.policy_chunk_embeddings (
                      policy_chunk_id, profile_key, embedding
                    ) values (%s, %s, %s::extensions.vector)
                    on conflict (policy_chunk_id, profile_key) do nothing
                    returning policy_chunk_id
                    """,
                    (chunk.chunk_id, profile_key, str(list(vector))),
                )
                stored += 1 if cursor.fetchone() else 0
            connection.commit()
        return stored
