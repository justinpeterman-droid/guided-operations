import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { authorizeCurrentSession } from "@/server/auth/current-session";

import { getDailyPaperworkForCurrentSession } from "./get-daily-paperwork";

vi.mock("@/server/auth/current-session", () => ({
  authorizeCurrentSession: vi.fn(),
}));

const row = {
  template_id: "33333333-3333-4333-8333-333333333333",
  controlling_template_id: "33333333-3333-4333-8333-333333333333",
  template_code: "assignment_roster",
  title: "Fictional Training Assignment Roster",
  template_version: 1,
  source_revision: "FICTIONAL-V1",
  source_sha256: "a".repeat(64),
  print_orientation: "landscape",
  capabilities: ["screen", "print"],
  structure: { schema_version: 1, fictional: true },
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
  payload: {
    schema_version: 1,
    fields: { supervisor: null },
    tables: {},
  },
  validation: null,
  reason: null,
  saved_at: null,
};

describe("getDailyPaperworkForCurrentSession", () => {
  beforeEach(() => {
    vi.mocked(authorizeCurrentSession).mockResolvedValue({
      allowed: true,
      sessionId: "session-id",
      account: {} as never,
    });
  });

  it("returns a parsed private fictional definition to an administrator", async () => {
    const client = {
      rpc: vi.fn().mockResolvedValue({ data: [row], error: null }),
    };
    const result = await getDailyPaperworkForCurrentSession(
      {
        kind: "assignment_roster",
        workDate: "2026-08-27",
        shiftCode: "A",
      },
      client as never,
    );
    expect(result.kind).toBe("found");
    expect(client.rpc).toHaveBeenCalledWith("get_daily_paperwork_v2", {
      p_template_code: "assignment_roster",
      p_work_date: "2026-08-27",
      p_shift_code: "A",
    });
  });

  it("conceals the definition from an officer", async () => {
    vi.mocked(authorizeCurrentSession).mockResolvedValue({
      allowed: false,
      reason: "insufficient_role",
    });
    const client = { rpc: vi.fn() };
    expect(
      await getDailyPaperworkForCurrentSession(
        {
          kind: "assignment_roster",
          workDate: "2026-08-27",
          shiftCode: "A",
        },
        client as never,
      ),
    ).toEqual({ kind: "denied" });
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("rejects malformed private definitions instead of rendering them", async () => {
    const client = {
      rpc: vi.fn().mockResolvedValue({
        data: [{ ...row, field_schema: {} }],
        error: null,
      }),
    };
    expect(
      await getDailyPaperworkForCurrentSession(
        {
          kind: "assignment_roster",
          workDate: "2026-08-27",
          shiftCode: "A",
        },
        client as never,
      ),
    ).toEqual({ kind: "unavailable" });
  });
});
