import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/server/auth/current-session", () => ({
  authorizeCurrentSession: vi.fn(),
}));

import { authorizeCurrentSession } from "@/server/auth/current-session";

import {
  listLegalHoldsForCurrentSession,
  placeLegalHold,
  releaseLegalHold,
  type LegalHoldStore,
} from "./legal-hold";

const actorId = "11111111-1111-4111-8111-111111111111";
const scopeId = "22222222-2222-4222-8222-222222222222";
const holdId = "33333333-3333-4333-8333-333333333333";

function store(): LegalHoldStore {
  return {
    place: vi.fn().mockResolvedValue(holdId),
    release: vi.fn().mockResolvedValue(undefined),
    list: vi.fn().mockResolvedValue([
      {
        holdId,
        scopeType: "incident",
        scopeId,
        authorityReference: "FICTIONAL-HOLD-001",
        createdAt: "2026-08-27T03:00:00.000Z",
        releasedAt: null,
        releaseAuthorityReference: null,
      },
    ]),
  };
}

function authorization(actorAuthUserId: string | null = actorId) {
  return {
    consume: vi
      .fn()
      .mockResolvedValue(actorAuthUserId ? { actorAuthUserId } : null),
  };
}

describe("legal hold operations", () => {
  beforeEach(() => vi.clearAllMocks());

  it("places a validated hold only after consuming a purpose-bound approval", async () => {
    const legalHoldStore = store();
    const result = await placeLegalHold(
      {
        scopeType: "incident",
        scopeId,
        authorityReference: "FICTIONAL-HOLD-001",
      },
      { authorization: authorization(), store: legalHoldStore },
    );

    expect(result).toEqual({ status: "placed", holdId });
    expect(legalHoldStore.place).toHaveBeenCalledWith(actorId, {
      scopeType: "incident",
      scopeId,
      authorityReference: "FICTIONAL-HOLD-001",
    });
  });

  it("rejects invalid authority text without consuming the approval", async () => {
    const approval = authorization();
    const legalHoldStore = store();
    const result = await placeLegalHold(
      {
        scopeType: "incident",
        scopeId,
        authorityReference: "contains <restricted> markup",
      },
      { authorization: approval, store: legalHoldStore },
    );

    expect(result).toEqual({ status: "invalid_input" });
    expect(approval.consume).not.toHaveBeenCalled();
    expect(legalHoldStore.place).not.toHaveBeenCalled();
  });

  it("releases a hold only after a separate release approval", async () => {
    const legalHoldStore = store();
    const result = await releaseLegalHold(
      { holdId, authorityReference: "FICTIONAL-RELEASE-001" },
      { authorization: authorization(), store: legalHoldStore },
    );

    expect(result).toEqual({ status: "released" });
    expect(legalHoldStore.release).toHaveBeenCalledWith(
      actorId,
      holdId,
      "FICTIONAL-RELEASE-001",
    );
  });

  it("lists only after a current administrator check and validates the DTO", async () => {
    vi.mocked(authorizeCurrentSession).mockResolvedValue({
      allowed: true,
      account: { authUserId: actorId },
    } as never);
    const legalHoldStore = store();

    const result = await listLegalHoldsForCurrentSession(
      {} as never,
      legalHoldStore,
      { includeReleased: true, limit: 100 },
    );

    expect(result.kind).toBe("listed");
    expect(legalHoldStore.list).toHaveBeenCalledWith(actorId, {
      includeReleased: true,
      limit: 100,
    });
  });

  it("does not query the private register for a non-administrator", async () => {
    vi.mocked(authorizeCurrentSession).mockResolvedValue({
      allowed: false,
      reason: "wrong_role",
    } as never);
    const legalHoldStore = store();

    const result = await listLegalHoldsForCurrentSession(
      {} as never,
      legalHoldStore,
      { includeReleased: true, limit: 100 },
    );

    expect(result).toEqual({ kind: "denied" });
    expect(legalHoldStore.list).not.toHaveBeenCalled();
  });
});
