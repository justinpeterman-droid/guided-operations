import "server-only";

import postgres from "postgres";

import { getAuthServerEnvironment } from "@/lib/env/auth-server";

let improvementSql: ReturnType<typeof postgres> | undefined;

function sql(): ReturnType<typeof postgres> {
  if (improvementSql) return improvementSql;
  improvementSql = postgres(getAuthServerEnvironment().SUPABASE_DB_URL, {
    max: 1,
    prepare: false,
    idle_timeout: 5,
  });
  return improvementSql;
}

/** Private adapter for trusted server-derived release and file-integrity data. */
export function createPrivateImprovementStore() {
  const client = sql();
  return {
    async getPendingFormCandidate(
      requestId: string,
      actorAccountId: string,
    ): Promise<Readonly<{
      storagePath: string;
      declaredMediaType: string;
      declaredByteSize: number;
      declaredSha256: string;
    }> | null> {
      const rows = await client<
        ReadonlyArray<{
          storage_path: string;
          declared_media_type: string;
          declared_byte_size: number;
          declared_sha256: string;
        }>
      >`
        select
          file.storage_path,
          file.declared_media_type,
          file.declared_byte_size,
          file.declared_sha256
        from app_private.form_candidate_files as file
        join app_private.improvement_requests as request
          on request.id = file.request_id
        where file.request_id = ${requestId}::uuid
          and file.uploaded_by_account_id = ${actorAccountId}::uuid
          and request.submitted_by_account_id = ${actorAccountId}::uuid
          and file.upload_state = 'uploading'
          and file.expires_at > statement_timestamp()
        limit 1
      `;
      const row = rows.at(0);
      return row
        ? {
            storagePath: row.storage_path,
            declaredMediaType: row.declared_media_type,
            declaredByteSize: Number(row.declared_byte_size),
            declaredSha256: row.declared_sha256,
          }
        : null;
    },
    async getReviewableFormCandidate(
      requestId: string,
      facilityId: string,
    ): Promise<Readonly<{
      storageBucket: string;
      storagePath: string;
      originalFilename: string;
      actualMediaType: string;
      actualByteSize: number;
      actualSha256: string;
    }> | null> {
      const rows = await client<
        ReadonlyArray<{
          storage_bucket: string;
          storage_path: string;
          original_filename: string;
          actual_media_type: string;
          actual_byte_size: number;
          actual_sha256: string;
        }>
      >`
        select
          file.storage_bucket,
          file.storage_path,
          file.original_filename,
          file.actual_media_type,
          file.actual_byte_size,
          file.actual_sha256
        from app_private.form_candidate_files as file
        join app_private.improvement_requests as request
          on request.id = file.request_id
        where file.request_id = ${requestId}::uuid
          and file.facility_id = ${facilityId}::uuid
          and request.facility_id = ${facilityId}::uuid
          and file.upload_state = 'uploaded'
          and file.expires_at > statement_timestamp()
        limit 1
      `;
      const row = rows.at(0);
      return row
        ? {
            storageBucket: row.storage_bucket,
            storagePath: row.storage_path,
            originalFilename: row.original_filename,
            actualMediaType: row.actual_media_type,
            actualByteSize: Number(row.actual_byte_size),
            actualSha256: row.actual_sha256,
          }
        : null;
    },
    async recordReleaseSha(
      requestId: string,
      actorAccountId: string,
      releaseSha: string | undefined,
    ): Promise<void> {
      if (!releaseSha || !/^[a-f0-9]{40}$/.test(releaseSha)) return;
      await client`
        select app_private.set_improvement_request_release_sha(
          ${requestId}::uuid,
          ${actorAccountId}::uuid,
          ${releaseSha}
        )
      `;
    },
    async finalizeFormCandidate(
      requestId: string,
      actorAccountId: string,
      byteSize: number,
      sha256: string,
      mediaType: string,
    ): Promise<void> {
      const rows = await client<ReadonlyArray<{ finalized: boolean }>>`
        select app_private.finalize_form_candidate_upload(
          ${requestId}::uuid,
          ${actorAccountId}::uuid,
          ${byteSize}::bigint,
          ${sha256},
          ${mediaType}
        ) as finalized
      `;
      if (rows.at(0)?.finalized !== true) {
        throw new Error("Form candidate finalization was rejected.");
      }
    },
  };
}
