import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));
vi.mock("@/server/paperwork/count-sheet-revision-history", () => ({
  getCountSheetRevisionForCurrentSession: vi.fn(),
  listCountSheetRevisionsForCurrentSession: vi.fn(),
}));

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getCountSheetRevisionForCurrentSession,
  listCountSheetRevisionsForCurrentSession,
} from "@/server/paperwork/count-sheet-revision-history";

import { GET } from "./route";

const client = {};
const recordId = "11111111-1111-4111-8111-111111111111";

describe("GET Count Sheet revision history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createSupabaseServerClient).mockResolvedValue(client as never);
  });

  it("returns an authorized no-store history list", async () => {
    vi.mocked(listCountSheetRevisionsForCurrentSession).mockResolvedValue({
      kind: "listed",
      revisions: [{ revisionNumber: 2 }] as never,
    });
    const response = await GET(
      new Request(`https://example.test/count-sheets/${recordId}/revisions`),
      { params: Promise.resolve({ recordId }) },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(listCountSheetRevisionsForCurrentSession).toHaveBeenCalledWith(
      recordId,
      client,
    );
  });

  it("loads a selected historical snapshot through the detail boundary", async () => {
    vi.mocked(getCountSheetRevisionForCurrentSession).mockResolvedValue({
      kind: "found",
      revision: { revisionNumber: 1 } as never,
    });
    const response = await GET(
      new Request(
        `https://example.test/count-sheets/${recordId}/revisions?revision_number=1`,
      ),
      { params: Promise.resolve({ recordId }) },
    );
    expect(response.status).toBe(200);
    expect(getCountSheetRevisionForCurrentSession).toHaveBeenCalledWith(
      recordId,
      "1",
      client,
    );
    expect(listCountSheetRevisionsForCurrentSession).not.toHaveBeenCalled();
  });
});
