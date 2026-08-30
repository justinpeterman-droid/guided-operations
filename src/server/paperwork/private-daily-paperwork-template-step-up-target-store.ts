import "server-only";

import postgres from "postgres";

import { getAuthServerEnvironment } from "@/lib/env/auth-server";
import type { AdminStepUpPurpose } from "@/server/auth/admin-step-up";

export type DailyPaperworkTemplateStepUpTargetStore = Readonly<{
  bind(
    input: Readonly<{
      authUserId: string;
      sessionId: string;
      authVersion: number;
      purpose: Extract<
        AdminStepUpPurpose,
        "paperwork.template_import" | "paperwork.template_rollback"
      >;
      requestId: string;
      packageDigest: string;
    }>,
  ): Promise<boolean>;
}>;

let targetSql: ReturnType<typeof postgres> | undefined;

function sql(): ReturnType<typeof postgres> {
  if (targetSql) return targetSql;
  targetSql = postgres(getAuthServerEnvironment().SUPABASE_DB_URL, {
    max: 1,
    prepare: false,
    idle_timeout: 5,
  });
  return targetSql;
}

export function createDailyPaperworkTemplateStepUpTargetStore(): DailyPaperworkTemplateStepUpTargetStore {
  const client = sql();
  return {
    async bind(input) {
      const rows = await client<ReadonlyArray<{ bound: boolean }>>`
        select app_private.bind_admin_step_up_target(
          ${input.authUserId}::uuid,
          ${input.sessionId}::uuid,
          ${input.authVersion},
          ${input.purpose},
          ${input.requestId}::uuid,
          ${input.packageDigest}
        ) as bound
      `;
      return rows.at(0)?.bound === true;
    },
  };
}
