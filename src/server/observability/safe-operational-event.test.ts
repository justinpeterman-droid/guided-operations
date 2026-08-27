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
});
