import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  buildSafeOperationalEvent,
  writeSafeOperationalEvent,
} from "./safe-operational-event";

const baseEvent = {
  event_name: "policy_answer.request" as const,
  outcome: "answered" as const,
  request_id: "11111111-1111-4111-8111-111111111111",
  status_code: 200,
  duration_ms: 42,
  citation_count: 2,
  environment: "preview" as const,
  corpus_version: "fictional-corpus-v1",
};

describe("safe operational events", () => {
  it("emits only the fixed allowlist when explicitly enabled", () => {
    const sink = vi.fn();
    writeSafeOperationalEvent(baseEvent, {
      environment: {
        SAFE_OPERATIONAL_LOGGING_ENABLED: "true",
        VERCEL_DEPLOYMENT_ID: "dpl_fictional",
        VERCEL_GIT_COMMIT_SHA: "a".repeat(40),
      },
      now: () => new Date("2026-08-26T12:00:00.000Z"),
      sink,
    });

    expect(sink).toHaveBeenCalledOnce();
    expect(JSON.parse(sink.mock.calls[0][0] as string)).toEqual({
      ...baseEvent,
      timestamp: "2026-08-26T12:00:00.000Z",
      deployment_id: "dpl_fictional",
      commit_sha: "a".repeat(40),
    });
  });

  it("emits nothing while the fail-closed gate is disabled", () => {
    const sink = vi.fn();
    writeSafeOperationalEvent(baseEvent, {
      environment: { SAFE_OPERATIONAL_LOGGING_ENABLED: "false" },
      sink,
    });
    expect(sink).not.toHaveBeenCalled();
  });

  it("accepts the answer-report citation limit", () => {
    expect(
      buildSafeOperationalEvent(
        {
          ...baseEvent,
          event_name: "answer_report.request",
          citation_count: 20,
        },
        { environment: {} },
      ).citation_count,
    ).toBe(20);
  });

  it("rejects arbitrary fields that could carry protected content", () => {
    expect(() =>
      buildSafeOperationalEvent(
        {
          ...baseEvent,
          prompt: "Fictional protected body",
          passcode: "fictional-passcode-value",
        } as never,
        { environment: {} },
      ),
    ).toThrow();
  });

  it("does not alter application flow when telemetry delivery fails", () => {
    expect(() =>
      writeSafeOperationalEvent(baseEvent, {
        environment: { SAFE_OPERATIONAL_LOGGING_ENABLED: "true" },
        sink: () => {
          throw new Error("Fictional sink failure");
        },
      }),
    ).not.toThrow();
  });

  it("contains no place for raw questions, answers, or personnel values", () => {
    const event = buildSafeOperationalEvent(baseEvent, {
      environment: {},
      now: () => new Date("2026-08-26T12:00:00.000Z"),
    });
    const keys = Object.keys(event);
    expect(keys).not.toEqual(
      expect.arrayContaining([
        "question",
        "answer",
        "prompt",
        "response",
        "employee_number",
        "incident_narrative",
      ]),
    );
  });

  it("records a policy-source read without a document id, path, or URL", () => {
    const event = buildSafeOperationalEvent(
      {
        event_name: "policy_source.read",
        outcome: "served",
        request_id: "11111111-1111-4111-8111-111111111111",
        status_code: 200,
        duration_ms: 12,
        environment: "preview",
      },
      {
        environment: {},
        now: () => new Date("2026-08-27T12:00:00.000Z"),
      },
    );

    expect(event).toMatchObject({
      event_name: "policy_source.read",
      outcome: "served",
    });
    expect(Object.keys(event)).not.toEqual(
      expect.arrayContaining([
        "document_id",
        "document_version_id",
        "storage_path",
        "source_url",
      ]),
    );
  });

  it("records package review without source or administrator data", () => {
    const event = buildSafeOperationalEvent(
      {
        event_name: "daily_paperwork_package.request",
        outcome: "reviewed",
        request_id: "11111111-1111-4111-8111-111111111111",
        status_code: 200,
        duration_ms: 18,
        environment: "production",
      },
      {
        environment: {},
        now: () => new Date("2026-08-28T12:00:00.000Z"),
      },
    );

    expect(event).toMatchObject({
      event_name: "daily_paperwork_package.request",
      outcome: "reviewed",
    });
    expect(Object.keys(event)).not.toEqual(
      expect.arrayContaining([
        "administrator_id",
        "filename",
        "package_digest",
        "source_authority",
        "source_revision",
      ]),
    );
  });

  it("records authentication lifecycle outcomes without account or credential data", () => {
    const event = buildSafeOperationalEvent(
      {
        event_name: "auth.passcode_change",
        outcome: "changed",
        request_id: "11111111-1111-4111-8111-111111111111",
        status_code: 200,
        duration_ms: 9,
        environment: "production",
      },
      {
        environment: {},
        now: () => new Date("2026-08-28T12:00:00.000Z"),
      },
    );

    expect(event).toMatchObject({
      event_name: "auth.passcode_change",
      outcome: "changed",
    });
    expect(Object.keys(event)).not.toEqual(
      expect.arrayContaining([
        "auth_user_id",
        "employee_number",
        "passcode",
        "session_id",
      ]),
    );
  });

  it("records retention outcomes without target, proof, or backup data", () => {
    const event = buildSafeOperationalEvent(
      {
        event_name: "admin.retention_deletion_execute",
        outcome: "completed",
        request_id: "11111111-1111-4111-8111-111111111111",
        status_code: 200,
        duration_ms: 14,
        environment: "production",
      },
      {
        environment: {},
        now: () => new Date("2026-08-28T12:00:00.000Z"),
      },
    );

    expect(event).toMatchObject({
      event_name: "admin.retention_deletion_execute",
      outcome: "completed",
    });
    expect(Object.keys(event)).not.toEqual(
      expect.arrayContaining([
        "admin_user_id",
        "record_id",
        "legal_hold_id",
        "authority_reference",
        "step_up_token",
        "backup_reference",
        "backup_manifest_sha256",
      ]),
    );
  });

  it("records administrator account outcomes without identity or handoff data", () => {
    const event = buildSafeOperationalEvent(
      {
        event_name: "admin.account_reset_passcode",
        outcome: "reset",
        request_id: "11111111-1111-4111-8111-111111111111",
        status_code: 200,
        duration_ms: 11,
        environment: "production",
      },
      {
        environment: {},
        now: () => new Date("2026-08-28T12:00:00.000Z"),
      },
    );

    expect(event).toMatchObject({
      event_name: "admin.account_reset_passcode",
      outcome: "reset",
    });
    expect(Object.keys(event)).not.toEqual(
      expect.arrayContaining([
        "administrator_id",
        "account_id",
        "employee_number",
        "display_name",
        "role",
        "shift_code",
        "step_up_request_id",
        "step_up_token",
        "temporary_passcode",
      ]),
    );
  });

  it("records readiness without configuration, provider, or credential details", () => {
    const event = buildSafeOperationalEvent(
      {
        event_name: "health.readiness",
        outcome: "service_unavailable",
        request_id: "11111111-1111-4111-8111-111111111111",
        status_code: 503,
        duration_ms: 8,
        environment: "production",
      },
      {
        environment: {},
        now: () => new Date("2026-08-28T12:00:00.000Z"),
      },
    );

    expect(event).toMatchObject({
      event_name: "health.readiness",
      outcome: "service_unavailable",
    });
    expect(Object.keys(event)).not.toEqual(
      expect.arrayContaining([
        "database_url",
        "provider_url",
        "publishable_key",
        "configuration_error",
        "project_id",
      ]),
    );
  });
});
