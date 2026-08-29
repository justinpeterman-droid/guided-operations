import "server-only";

import { z } from "zod";

import { getOpenAiDataControlsEnvironment } from "./openai-data-controls";

const schema = z.object({
  OPENAI_API_KEY: z.string().min(20),
  OPENAI_REPORT_DRAFT_MODEL: z.string().trim().min(1).max(160),
});

export function getOpenAiReportDraftEnvironment(
  environment: Record<string, string | undefined> = process.env,
) {
  getOpenAiDataControlsEnvironment(environment);
  return schema.parse({
    OPENAI_API_KEY: environment.OPENAI_API_KEY,
    OPENAI_REPORT_DRAFT_MODEL: environment.OPENAI_REPORT_DRAFT_MODEL,
  });
}
