import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { AuthorizedCurrentSession } from "@/server/auth/current-session";

import { fictionalDailyPaperworkSourcePackage } from "./daily-paperwork-source-package.test-fixture";
import { runDailyPaperworkTemplatePackageCommand } from "./daily-paperwork-template-package-command";

const session: AuthorizedCurrentSession = {
  allowed: true,
  sessionId: "00000000-0000-4000-8000-000000000003",
  account: {
    authUserId: "00000000-0000-4000-8000-000000000002",
    facilityId: "00000000-0000-4000-8000-000000000001",
    shiftCode: "A",
    role: "administrator",
    status: "active",
    authVersion: 1,
    mustChangePasscode: false,
  },
};

function command(action: "validate" | "register") {
  return {
    action,
    sourceAuthority: "Fictional training records owner",
    sourceRevision: "fictional-revision-1",
    activeFrom: "2026-09-01",
    expectedCurrentPackageDigest: null,
    rollbackOfPackageDigest: null,
    files: fictionalDailyPaperworkSourcePackage(),
  } as const;
}

describe("Daily Paperwork template package command", () => {
  it("returns only value-free evidence during review", async () => {
    const store = { register: vi.fn() };
    const result = await runDailyPaperworkTemplatePackageCommand(
      command("validate"),
      session,
      { store, hmacKey: "k".repeat(32) },
    );

    expect(result.status).toBe("reviewed");
    expect(store.register).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain("Fictional");
  });

  it("registers the exact reviewed package only with a one-time proof", async () => {
    const store = {
      register: vi
        .fn()
        .mockResolvedValue("00000000-0000-4000-8000-000000000099"),
    };
    const result = await runDailyPaperworkTemplatePackageCommand(
      {
        ...command("register"),
        proof: {
          token: "t".repeat(43),
          requestId: "00000000-0000-4000-8000-000000000004",
        },
        idempotencyKey: "fictional-idempotency-key-0001",
      },
      session,
      { store, hmacKey: "k".repeat(32) },
    );

    expect(result).toMatchObject({
      status: "registered",
      packageId: "00000000-0000-4000-8000-000000000099",
    });
    expect(store.register).toHaveBeenCalledOnce();
  });

  it("rejects partial packages and registration without proof", async () => {
    const store = { register: vi.fn() };
    await expect(
      runDailyPaperworkTemplatePackageCommand(
        { ...command("validate"), files: command("validate").files.slice(1) },
        session,
        { store, hmacKey: "k".repeat(32) },
      ),
    ).resolves.toEqual({ status: "invalid" });
    await expect(
      runDailyPaperworkTemplatePackageCommand(command("register"), session, {
        store,
        hmacKey: "k".repeat(32),
      }),
    ).resolves.toEqual({ status: "invalid" });
  });

  it("maps database concurrency rejection to a safe conflict", async () => {
    const store = {
      register: vi.fn().mockRejectedValue({ code: "40001" }),
    };
    const result = await runDailyPaperworkTemplatePackageCommand(
      {
        ...command("register"),
        proof: {
          token: "t".repeat(43),
          requestId: "00000000-0000-4000-8000-000000000004",
        },
        idempotencyKey: "fictional-idempotency-key-0001",
      },
      session,
      { store, hmacKey: "k".repeat(32) },
    );
    expect(result).toEqual({ status: "conflict" });
  });
});
