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
  reason_code: "reserved" | "budget_exhausted";
}>;

export type AiBudgetPersistence = Readonly<{
  reserve(
    operation: AiBudgetOperation,
    monthlyRequestCap: number,
    stopPercent: number,
  ): Promise<Reservation>;
}>;

export type AiRequestBudgetGuard = Readonly<{
  reserve(operation: AiBudgetOperation): Promise<void>;
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
    async reserve(operation, monthlyRequestCap, stopPercent) {
      const rows = await sql<Reservation[]>`
        select allowed, reason_code
        from app_private.reserve_ai_request_budget(
          ${operation}, ${monthlyRequestCap}, ${stopPercent}
        )
      `;
      const reservation = rows[0];
      if (!reservation) throw new Error("AI budget reservation unavailable");
      return reservation;
    },
  };
}

/**
 * Reserves a shared database-backed request slot before any provider call.
 * It receives no prompt, answer, actor, document, or operational identifier.
 */
export function createAiRequestBudgetGuard(
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
          operation,
          environment.AI_MONTHLY_REQUEST_CAP,
          environment.AI_BUDGET_STOP_PERCENT,
        );
      } catch {
        throw new AiBudgetCircuitOpenError("budget_check_failed");
      }

      if (!reservation.allowed) {
        throw new AiBudgetCircuitOpenError("budget_exhausted");
      }
    },
  };
}
