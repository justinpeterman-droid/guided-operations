import "server-only";

import postgres from "postgres";

import {
  getAiBudgetEnvironment,
  type AiBudgetEnvironment,
} from "@/lib/env/ai-budget";

export type AiBudgetOperation = "policy_answer" | "report_draft";
export type AiBudgetReasonCode =
  "budget_check_failed" | "budget_exhausted" | "generation_disabled";

type Reservation = Readonly<{
  allowed: boolean;
  reason_code:
    | "reserved"
    | "budget_exhausted"
    | "account_monthly_limited"
    | "account_rate_limited"
    | "account_concurrency_limited";
  lease_id: string | null;
  lease_expires_at: string | null;
}>;

export type AiBudgetPersistence = Readonly<{
  reserve(
    accountId: string,
    operation: AiBudgetOperation,
    monthlyRequestCap: number,
    stopPercent: number,
    accountMonthlySharePercent: number,
    accountShortWindowMax: number,
    accountConcurrencyMax: number,
    leaseSeconds: number,
  ): Promise<Reservation>;
  release(accountId: string, leaseId: string): Promise<boolean>;
}>;

export type AiBudgetLease = Readonly<{
  providerTimeoutMs: number;
  release(): Promise<void>;
}>;
export type AiRequestBudgetGuard = Readonly<{
  reserve(operation: AiBudgetOperation): Promise<AiBudgetLease>;
}>;

export class AiBudgetCircuitOpenError extends Error {
  constructor(readonly reasonCode: AiBudgetReasonCode) {
    super("AI assistance is temporarily unavailable");
    this.name = "AiBudgetCircuitOpenError";
  }
}

let sharedAiBudgetSql: ReturnType<typeof postgres> | undefined;

function createPostgresPersistence(databaseUrl: string): AiBudgetPersistence {
  sharedAiBudgetSql ??= postgres(databaseUrl, {
    max: 1,
    prepare: false,
    idle_timeout: 5,
  });
  const sql = sharedAiBudgetSql;

  return {
    async reserve(
      accountId,
      operation,
      monthlyRequestCap,
      stopPercent,
      accountMonthlySharePercent,
      accountShortWindowMax,
      accountConcurrencyMax,
      leaseSeconds,
    ) {
      const rows = await sql<Reservation[]>`
        select allowed, reason_code, lease_id, lease_expires_at::text
        from app_private.reserve_ai_request_budget(
          ${accountId}::uuid,
          ${operation},
          ${monthlyRequestCap},
          ${stopPercent},
          ${accountMonthlySharePercent},
          ${accountShortWindowMax},
          ${accountConcurrencyMax},
          ${leaseSeconds}
        )
      `;
      const reservation = rows[0];
      if (!reservation) throw new Error("AI budget reservation unavailable");
      return reservation;
    },
    async release(accountId, leaseId) {
      const rows = await sql<{ released: boolean }[]>`
        select app_private.release_ai_request_budget_lease(
          ${accountId}::uuid, ${leaseId}::uuid
        ) as released
      `;
      return rows[0]?.released === true;
    },
  };
}

/**
 * Reserves a shared database-backed request slot before any provider call.
 * It receives only the authorized opaque account UUID and operation—never a
 * prompt, answer, personnel field, document, or record identifier.
 */
export function createAiRequestBudgetGuard(
  accountId: string,
  options: Readonly<{
    environment?: Record<string, string | undefined>;
    persistence?: AiBudgetPersistence;
  }> = {},
): AiRequestBudgetGuard {
  let parsedEnvironment: AiBudgetEnvironment | undefined;
  let persistence = options.persistence;

  return {
    async reserve(operation) {
      const environment = (parsedEnvironment ??= getAiBudgetEnvironment(
        options.environment,
      ));
      if (!environment.AI_GENERATION_ENABLED) {
        throw new AiBudgetCircuitOpenError("generation_disabled");
      }

      persistence ??= createPostgresPersistence(environment.SUPABASE_DB_URL);
      let reservation: Reservation;
      try {
        reservation = await persistence.reserve(
          accountId,
          operation,
          environment.AI_MONTHLY_REQUEST_CAP,
          environment.AI_BUDGET_STOP_PERCENT,
          environment.AI_ACCOUNT_MONTHLY_SHARE_PERCENT,
          environment.AI_ACCOUNT_SHORT_WINDOW_MAX,
          environment.AI_ACCOUNT_CONCURRENCY_MAX,
          environment.AI_REQUEST_LEASE_SECONDS,
        );
      } catch {
        throw new AiBudgetCircuitOpenError("budget_check_failed");
      }

      if (!reservation.allowed || !reservation.lease_id) {
        throw new AiBudgetCircuitOpenError("budget_exhausted");
      }

      const leaseId = reservation.lease_id;
      const remainingLeaseMs =
        Date.parse(reservation.lease_expires_at ?? "") - Date.now() - 5_000;
      if (!Number.isFinite(remainingLeaseMs) || remainingLeaseMs <= 0) {
        await persistence.release(accountId, leaseId).catch(() => false);
        throw new AiBudgetCircuitOpenError("budget_check_failed");
      }
      let released = false;
      return {
        providerTimeoutMs: Math.min(
          environment.AI_REQUEST_LEASE_SECONDS * 1_000 - 5_000,
          Math.floor(remainingLeaseMs),
        ),
        async release() {
          if (released) return;
          try {
            released = await persistence!.release(accountId, leaseId);
          } catch {
            throw new AiBudgetCircuitOpenError("budget_check_failed");
          }
          if (!released)
            throw new AiBudgetCircuitOpenError("budget_check_failed");
        },
      };
    },
  };
}
