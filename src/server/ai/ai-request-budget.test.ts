import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  AiBudgetCircuitOpenError,
  createAiRequestBudgetGuard,
} from "./ai-request-budget";

const environment = {
  AI_GENERATION_ENABLED: "true",
  AI_MONTHLY_REQUEST_CAP: "100",
  AI_BUDGET_STOP_PERCENT: "90",
  SUPABASE_DB_URL: "postgresql://fictional:fictional@localhost:5432/fictional",
};

describe("AI request budget guard", () => {
  it("reserves a content-free shared request slot", async () => {
    const reserve = vi.fn().mockResolvedValue({
      allowed: true,
      reason_code: "reserved",
    });
    const guard = createAiRequestBudgetGuard({
      environment,
      persistence: { reserve },
    });

    await expect(guard.reserve("policy_answer")).resolves.toBeUndefined();
    expect(reserve).toHaveBeenCalledWith("policy_answer", 100, 90);
  });

  it("stops before persistence when AI generation is disabled", async () => {
    const reserve = vi.fn();
    const guard = createAiRequestBudgetGuard({
      environment: { ...environment, AI_GENERATION_ENABLED: "false" },
      persistence: { reserve },
    });

    await expect(guard.reserve("report_draft")).rejects.toMatchObject({
      reasonCode: "generation_disabled",
    });
    expect(reserve).not.toHaveBeenCalled();
  });

  it("fails closed when the shared budget cannot be checked", async () => {
    const guard = createAiRequestBudgetGuard({
      environment,
      persistence: { reserve: vi.fn().mockRejectedValue(new Error("down")) },
    });

    await expect(guard.reserve("policy_answer")).rejects.toEqual(
      new AiBudgetCircuitOpenError("budget_check_failed"),
    );
  });

  it("reports exhaustion without exposing counters or provider content", async () => {
    const guard = createAiRequestBudgetGuard({
      environment,
      persistence: {
        reserve: vi.fn().mockResolvedValue({
          allowed: false,
          reason_code: "budget_exhausted",
        }),
      },
    });

    await expect(guard.reserve("report_draft")).rejects.toMatchObject({
      reasonCode: "budget_exhausted",
      message: "AI assistance is temporarily unavailable",
    });
  });
});
