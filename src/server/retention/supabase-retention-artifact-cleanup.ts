import "server-only";

import { createSupabaseAuthAdminClient } from "@/server/auth/supabase-auth-adapters";

import type { RetentionArtifactCleanup } from "./retention-deletion";

const REMOVE_BATCH_SIZE = 100;

/** Deletes only pre-registered private exports, then verifies every path absent. */
export function createSupabaseRetentionArtifactCleanup(): RetentionArtifactCleanup {
  const client = createSupabaseAuthAdminClient();
  return {
    async removeAndVerify(artifacts) {
      const paths = artifacts.map((artifact) => artifact.storagePath);
      for (let offset = 0; offset < paths.length; offset += REMOVE_BATCH_SIZE) {
        const batch = paths.slice(offset, offset + REMOVE_BATCH_SIZE);
        const { error } = await client.storage
          .from("generated-exports")
          .remove(batch);
        if (error)
          throw new Error("Unable to remove approved Storage exports.");
      }

      for (const artifact of artifacts) {
        const result = await client.storage
          .from(artifact.storageBucket)
          .exists(artifact.storagePath);
        if (result.error || result.data !== false)
          throw new Error("An approved Storage export still exists.");
      }
    },
  };
}
