import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createAuthAttemptStore } from "./private-auth-attempt-store";

const subjects = [
  { kind: "account", digest: "a".repeat(64) },
  { kind: "device", digest: "b".repeat(64) },
  { kind: "network", digest: "c".repeat(64) },
  { kind: "global", digest: "d".repeat(64) },
] as const;

describe("createAuthAttemptStore", () => {
  it("reads opaque attempt timestamps through its private persistence boundary", async () => {
    const persistence = {
      listOccurredAt: vi.fn().mockResolvedValue([1000, 2000]),
      insert: vi.fn().mockResolvedValue(undefined),
    };
    const store = createAuthAttemptStore(persistence);
    const since = new Date("2026-08-26T11:59:00.000Z");

    await expect(store.listOccurredAt(subjects[0], since)).resolves.toEqual([
      1000, 2000,
    ]);
    expect(persistence.listOccurredAt).toHaveBeenCalledWith(subjects[0], since);
  });

  it("writes one redacted outcome per rate-limit dimension", async () => {
    const persistence = {
      listOccurredAt: vi.fn().mockResolvedValue([]),
      insert: vi.fn().mockResolvedValue(undefined),
    };
    const store = createAuthAttemptStore(persistence);
    const expiresAt = new Date("2026-08-26T12:01:00.000Z");

    await store.record(subjects, "failed", expiresAt);

    expect(persistence.insert).toHaveBeenCalledTimes(4);
    expect(persistence.insert).toHaveBeenNthCalledWith(
      1,
      subjects[0],
      "failed",
      expiresAt,
    );
    expect(persistence.insert).toHaveBeenNthCalledWith(
      4,
      subjects[3],
      "failed",
      expiresAt,
    );
  });
});
