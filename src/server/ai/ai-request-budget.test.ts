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
const accountId = "11111111-1111-4111-8111-111111111111";

describe("AI request budget guard", () => {
  it("reserves a content-free shared request slot", async () => {
    const reserve = vi.fn().mockResolvedValue({
      allowed: true,
      reason_code: "reserved",
      lease_id: "22222222-2222-4222-8222-222222222222",
    });
    const release = vi.fn().mockResolvedValue(true);
    const guard = createAiRequestBudgetGuard(accountId, {
      environment,
      persistence: { reserve, release },
    });

    const lease = await guard.reserve("policy_answer");
    expect(lease.providerTimeoutMs).toBe(85_000);
    await expect(lease.release()).resolves.toBeUndefined();
    expect(reserve).toHaveBeenCalledWith(
      accountId,
      "policy_answer",
      100,
      90,
      5,
      6,
      2,
      90,
    );
    expect(release).toHaveBeenCalledWith(
      accountId,
      "22222222-2222-4222-8222-222222222222",
    );
  });

  it("stops before persistence when AI generation is disabled", async () => {
    const reserve = vi.fn();
    const guard = createAiRequestBudgetGuard(accountId, {
      environment: { ...environment, AI_GENERATION_ENABLED: "false" },
      persistence: { reserve, release: vi.fn() },
    });

    await expect(guard.reserve("report_draft")).rejects.toMatchObject({
      reasonCode: "generation_disabled",
    });
    expect(reserve).not.toHaveBeenCalled();
  });

  it("fails closed when the shared budget cannot be checked", async () => {
    const guard = createAiRequestBudgetGuard(accountId, {
      environment,
      persistence: {
        reserve: vi.fn().mockRejectedValue(new Error("down")),
        release: vi.fn(),
      },
    });

    await expect(guard.reserve("policy_answer")).rejects.toEqual(
      new AiBudgetCircuitOpenError("budget_check_failed"),
    );
  });

  it("reports exhaustion without exposing counters or provider content", async () => {
    const guard = createAiRequestBudgetGuard(accountId, {
      environment,
      persistence: {
        reserve: vi.fn().mockResolvedValue({
          allowed: false,
          reason_code: "budget_exhausted",
          lease_id: null,
        }),
        release: vi.fn(),
      },
    });

    await expect(guard.reserve("report_draft")).rejects.toMatchObject({
      reasonCode: "budget_exhausted",
      message: "AI assistance is temporarily unavailable",
    });
  });
});
