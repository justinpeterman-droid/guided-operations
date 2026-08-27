import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { assertApplicationEnvironmentReadiness } from "./application-environment-readiness";

function validEnvironment(overrides: Record<string, string | undefined> = {}) {
  return {
    APP_ENV: "preview",
    APP_ORIGIN: "https://fictional-preview.example.test",
    NEXT_PUBLIC_SUPABASE_URL: "https://fictional-project.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "fictional-publishable-key",
    SUPABASE_SECRET_KEY: "fictional-secret-key",
    SUPABASE_DB_URL:
      "postgresql://fictional:fictional@localhost:5432/fictional",
    EMPLOYEE_LOOKUP_PEPPER: "e".repeat(32),
    AUTH_DUMMY_ALIAS: "timing-defense@fictional.invalid",
    CSRF_HMAC_KEY: "c".repeat(32),
    AUTH_SIGN_IN_ENABLED: "false",
    SAFE_OPERATIONAL_LOGGING_ENABLED: "false",
    INCIDENT_IDEMPOTENCY_HMAC_KEY: "i".repeat(32),
    AI_PROVIDER: "openai",
    AI_GENERATION_ENABLED: "true",
    AI_MONTHLY_REQUEST_CAP: "1000",
    AI_BUDGET_STOP_PERCENT: "90",
    OPENAI_API_KEY: "o".repeat(20),
    OPENAI_POLICY_MODEL: "fictional-policy-model",
    OPENAI_REPORT_DRAFT_MODEL: "fictional-report-model",
    OPENAI_EMBEDDING_MODEL: "fictional-embedding-model",
    RAG_CORPUS_VERSION: "fictional-corpus-v1",
    ...overrides,
  };
}

describe("application environment readiness", () => {
  it("accepts a complete Preview contract while sign-in remains gated", () => {
    expect(assertApplicationEnvironmentReadiness(validEnvironment())).toEqual({
      publicSupabase: {
        NEXT_PUBLIC_SUPABASE_URL: "https://fictional-project.supabase.co",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "fictional-publishable-key",
      },
    });
  });

  it("rejects Production when sign-in is not explicitly enabled", () => {
    expect(() =>
      assertApplicationEnvironmentReadiness(
        validEnvironment({
          APP_ENV: "production",
          APP_ORIGIN: "https://guided-operations.example.test",
        }),
      ),
    ).toThrow("Production sign-in must be explicitly enabled.");
  });

  it("rejects a missing pinned report-draft model", () => {
    expect(() =>
      assertApplicationEnvironmentReadiness(
        validEnvironment({ OPENAI_REPORT_DRAFT_MODEL: undefined }),
      ),
    ).toThrow();
  });

  it("rejects a missing AI monthly request cap", () => {
    expect(() =>
      assertApplicationEnvironmentReadiness(
        validEnvironment({ AI_MONTHLY_REQUEST_CAP: undefined }),
      ),
    ).toThrow();
  });

  it("rejects Production when allowlisted operational logging is disabled", () => {
    expect(() =>
      assertApplicationEnvironmentReadiness(
        validEnvironment({
          APP_ENV: "production",
          APP_ORIGIN: "https://guided-operations.example.test",
          AUTH_SIGN_IN_ENABLED: "true",
        }),
      ),
    ).toThrow("Production safe operational logging must be enabled.");
  });

  it("accepts Production only when sign-in and safe logging are explicit", () => {
    expect(() =>
      assertApplicationEnvironmentReadiness(
        validEnvironment({
          APP_ENV: "production",
          APP_ORIGIN: "https://guided-operations.example.test",
          AUTH_SIGN_IN_ENABLED: "true",
          SAFE_OPERATIONAL_LOGGING_ENABLED: "true",
        }),
      ),
    ).not.toThrow();
  });

  it("rejects reuse of security keys across purposes", () => {
    expect(() =>
      assertApplicationEnvironmentReadiness(
        validEnvironment({
          INCIDENT_IDEMPOTENCY_HMAC_KEY: "c".repeat(32),
        }),
      ),
    ).toThrow("Security keys must be unique per purpose.");
  });
});
