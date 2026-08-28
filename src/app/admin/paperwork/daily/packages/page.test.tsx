import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));
vi.mock("@/server/paperwork/list-daily-paperwork-template-packages", () => ({
  listDailyPaperworkTemplatePackagesForCurrentSession: vi.fn(),
}));

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listDailyPaperworkTemplatePackagesForCurrentSession } from "@/server/paperwork/list-daily-paperwork-template-packages";

import { loadDailyPaperworkTemplatePackages } from "./page";

describe("loadDailyPaperworkTemplatePackages", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads only the current administrator's value-free package history", async () => {
    const client = {};
    vi.mocked(createSupabaseServerClient).mockResolvedValue(client as never);
    vi.mocked(
      listDailyPaperworkTemplatePackagesForCurrentSession,
    ).mockResolvedValue({ kind: "listed", packages: [] });

    await expect(loadDailyPaperworkTemplatePackages()).resolves.toEqual({
      kind: "listed",
      packages: [],
    });
    expect(
      listDailyPaperworkTemplatePackagesForCurrentSession,
    ).toHaveBeenCalledWith(client, 20);
  });
});
