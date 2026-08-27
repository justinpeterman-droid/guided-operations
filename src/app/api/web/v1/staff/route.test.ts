import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));
vi.mock("@/server/incidents/list-staff-selection", () => ({
  listStaffSelectionForCurrentSession: vi.fn(),
}));

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listStaffSelectionForCurrentSession } from "@/server/incidents/list-staff-selection";

import { GET } from "./route";

const client = {};

describe("GET /api/web/v1/staff", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns only the bounded staff-selection fields", async () => {
    vi.mocked(createSupabaseServerClient).mockResolvedValue(client as never);
    vi.mocked(listStaffSelectionForCurrentSession).mockResolvedValue({
      kind: "listed",
      staff: [
        {
          staffMemberId: "11111111-1111-4111-8111-111111111111",
          displayName: "Fictional Officer",
          employeeNumberHint: "12",
          shiftCode: "A",
          isCurrentAccount: true,
        },
      ],
    });

    const response = await GET(new Request("https://example.test?limit=25"));

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    await expect(response.json()).resolves.toMatchObject({
      data: {
        staff: [
          {
            displayName: "Fictional Officer",
            isCurrentAccount: true,
          },
        ],
      },
      meta: { api_version: "web-v1", request_id: expect.any(String) },
    });
    expect(listStaffSelectionForCurrentSession).toHaveBeenCalledWith(
      client,
      25,
    );
  });

  it("rejects an unbounded list before opening a database client", async () => {
    const response = await GET(new Request("https://example.test?limit=101"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "invalid_request" },
    });
    expect(createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("conceals an absent session behind the generic auth response", async () => {
    vi.mocked(createSupabaseServerClient).mockResolvedValue(client as never);
    vi.mocked(listStaffSelectionForCurrentSession).mockResolvedValue({
      kind: "denied",
    });

    const response = await GET(new Request("https://example.test"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "authentication_required" },
    });
  });
});
