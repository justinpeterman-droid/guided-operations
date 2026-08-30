import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { authorizeCurrentSession } from "@/server/auth/current-session";

import { saveDailyPaperworkForCurrentSession } from "./save-daily-paperwork";

vi.mock("@/server/auth/current-session", () => ({
  authorizeCurrentSession: vi.fn(),
}));

const definition = {
  template_id: "33333333-3333-4333-8333-333333333333",
  controlling_template_id: "33333333-3333-4333-8333-333333333333",
  template_code: "assignment_roster",
  title: "Fictional Training Assignment Roster",
  template_version: 1,
  source_revision: "FICTIONAL-V1",
  source_sha256: "a".repeat(64),
  print_orientation: "landscape",
  capabilities: ["screen", "print"],
  structure: { schema_version: 1 },
  field_schema: {
    schema_version: 1,
    fields: [
      {
        key: "supervisor",
        label: "Fictional supervisor",
        type: "text",
        required: true,
        max_length: 100,
      },
    ],
    tables: [],
  },
  editable: true,
  record_id: null,
  current_revision_number: null,
  payload: { schema_version: 1, fields: { supervisor: null }, tables: {} },
  validation: null,
  reason: null,
  saved_at: null,
};

const command = {
  kind: "assignment_roster",
  workDate: "2026-08-27",
  shiftCode: "A",
  baseRevisionNumber: 0,
  payload: {
    schema_version: 1,
    fields: { supervisor: "Fictional Supervisor" },
    tables: {},
  },
  reason: "Fictional initial save.",
  idempotencyKey: "fictional-retry-key-0001",
};

describe("saveDailyPaperworkForCurrentSession", () => {
  beforeEach(() => {
    vi.mocked(authorizeCurrentSession).mockResolvedValue({
      allowed: true,
      sessionId: "session-id",
      account: {} as never,
    });
  });

  it("sends only validated values and selection metadata to the save RPC", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: [definition], error: null })
      .mockResolvedValueOnce({
        data: [
          {
            record_id: "44444444-4444-4444-8444-444444444444",
            revision_number: 1,
          },
        ],
        error: null,
      });
    const result = await saveDailyPaperworkForCurrentSession(
      command,
      { rpc } as never,
      "h".repeat(64),
    );
    expect(result).toEqual({
      kind: "saved",
      recordId: "44444444-4444-4444-8444-444444444444",
      revisionNumber: 1,
    });
    expect(rpc.mock.calls[1]?.[0]).toBe("save_daily_paperwork_v2");
    expect(rpc.mock.calls[1]?.[1]).toMatchObject({
      p_template_code: "assignment_roster",
      p_work_date: "2026-08-27",
      p_shift_code: "A",
      p_base_revision_number: 0,
      p_payload: command.payload,
      p_reason: "Fictional initial save.",
      p_idempotency_key_digest: expect.stringMatching(/^[a-f0-9]{64}$/),
      p_request_digest: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(JSON.stringify(rpc.mock.calls[1]?.[1])).not.toContain("structure");
  });

  it("rejects undeclared values before calling the database writer", async () => {
    const rpc = vi.fn().mockResolvedValueOnce({
      data: [definition],
      error: null,
    });
    expect(
      await saveDailyPaperworkForCurrentSession(
        {
          ...command,
          payload: {
            ...command.payload,
            fields: {
              ...command.payload.fields,
              undeclared: "blocked",
            },
          },
        },
        { rpc } as never,
        "h".repeat(64),
      ),
    ).toEqual({ kind: "unavailable" });
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("does not write a historical form after its source becomes read-only", async () => {
    const rpc = vi.fn().mockResolvedValueOnce({
      data: [
        {
          ...definition,
          controlling_template_id: null,
          editable: false,
        },
      ],
      error: null,
    });
    expect(
      await saveDailyPaperworkForCurrentSession(
        command,
        { rpc } as never,
        "h".repeat(64),
      ),
    ).toEqual({ kind: "readonly" });
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
