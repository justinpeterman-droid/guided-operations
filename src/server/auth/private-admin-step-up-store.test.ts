import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createAdminStepUpStore } from "./private-admin-step-up-store";

const issueInput = {
  authUserId: "aaaaaaaa-0000-4000-8000-000000000001",
  sessionId: "bbbbbbbb-0000-4000-8000-000000000001",
  authVersion: 1,
  purpose: "account.disable" as const,
  tokenDigest: "a".repeat(43),
  requestId: "cccccccc-0000-4000-8000-000000000001",
  expiresAt: new Date("2026-08-26T18:05:00.000Z"),
};

describe("createAdminStepUpStore", () => {
  it("keeps issuing and consuming proofs behind a narrow server-only facade", async () => {
    const persistence = {
      issue: vi.fn().mockResolvedValue(undefined),
      consume: vi.fn().mockResolvedValue(true),
    };
    const store = createAdminStepUpStore(persistence);

    await expect(store.issue(issueInput)).resolves.toBeUndefined();
    await expect(store.consume(issueInput)).resolves.toBe(true);

    expect(persistence.issue).toHaveBeenCalledWith(issueInput);
    expect(persistence.consume).toHaveBeenCalledWith(issueInput);
  });
});
