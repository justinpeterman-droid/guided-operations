import { describe, expect, it, vi } from "vitest";

import { hashPasscode } from "../passcode";
import { createAuthService } from "../service";
import { hashOpaqueSecret, issueOpaqueToken } from "../tokens";
import type {
  AuthRepository,
  CurrentAccount,
  LoginAccount,
  StoredSession,
} from "../types";

const NOW = new Date("2026-08-29T12:00:00.000Z");
const ACCOUNT_ID = "11111111-1111-4111-8111-111111111111";
const STAFF_ID = "22222222-2222-4222-8222-222222222222";
const SECRETS = {
  employeeLookupPepper: "employee-lookup-pepper-32-characters!",
  sessionHmacKey: "session-hmac-key-32-characters-long!",
  deviceHmacKey: "device-hmac-key-32-characters-long!!",
  networkHmacKey: "network-hmac-key-32-characters-long!",
  csrfHmacKey: "csrf-hmac-key-32-characters-long!!!!",
};

const currentAccount: CurrentAccount = {
  accountId: ACCOUNT_ID,
  staffMemberId: STAFF_ID,
  displayName: "Officer Test Fictional",
  employeeNumberHint: "1001",
  employeeLookupHash: "a".repeat(64),
  role: "officer",
  status: "active",
  mustChangePasscode: false,
  authVersion: 1,
};

function makeRepository(): AuthRepository {
  return {
    lookupAccount: vi.fn(async () => null),
    applyRateLimit: vi.fn(async () => ({
      allowed: true,
      retryAfterSeconds: 0,
    })),
    recordLoginFailure: vi.fn(async () => undefined),
    createSession: vi.fn(async () => true),
    resolveSession: vi.fn(async () => null),
    refreshSession: vi.fn(async () => ({
      accepted: true,
      rotated: false,
      absoluteExpiresAt: new Date(NOW.getTime() + 12 * 60 * 60 * 1000),
    })),
    revokeSession: vi.fn(async () => true),
    loadCurrentAccount: vi.fn(async () => currentAccount),
    changePasscode: vi.fn(async () => 2),
    revokeAllSessions: vi.fn(async () => 2),
  };
}

function makeService(repository: AuthRepository) {
  return createAuthService({
    repository,
    secrets: SECRETS,
    now: () => new Date(NOW),
  });
}

async function activeLoginAccount(): Promise<LoginAccount> {
  return {
    accountId: ACCOUNT_ID,
    staffMemberId: STAFF_ID,
    passcodeHash: await hashPasscode("CorrectHorse9"),
    role: "officer",
    status: "active",
    mustChangePasscode: false,
    failedAttempts: 0,
    lockedUntil: null,
    authVersion: 1,
    temporaryExpiresAt: null,
  };
}

describe("opaque authentication service", () => {
  it("creates an opaque session after a valid individual login", async () => {
    const repository = makeRepository();
    vi.mocked(repository.lookupAccount).mockResolvedValue(
      await activeLoginAccount(),
    );
    const service = makeService(repository);

    const result = await service.signIn({
      employeeNumber: " test-1001 ",
      passcode: "CorrectHorse9",
      deviceId: "fictional-device",
      networkId: "198.51.100.10",
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.sessionToken).toMatch(
      /^[0-9a-f-]{36}\.[A-Za-z0-9_-]{43}$/,
    );
    expect(result.csrfToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(result.account.displayName).toBe("Officer Test Fictional");
    expect(repository.applyRateLimit).toHaveBeenCalledTimes(4);
    expect(repository.createSession).toHaveBeenCalledOnce();

    const createCall = vi.mocked(repository.createSession).mock.calls[0]?.[0];
    expect(createCall?.secretHash).toMatch(/^[a-f0-9]{64}$/);
    expect(createCall?.deviceHash).toMatch(/^[a-f0-9]{64}$/);
    expect(createCall?.networkHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(createCall)).not.toContain("CorrectHorse9");
    expect(JSON.stringify(createCall)).not.toContain("TEST-1001");
  });

  it("returns the same public failure for an unknown employee number", async () => {
    const repository = makeRepository();
    const service = makeService(repository);

    const result = await service.signIn({
      employeeNumber: "UNKNOWN-99",
      passcode: "WrongHorse9",
      deviceId: "fictional-device",
      networkId: "198.51.100.10",
    });

    expect(result).toEqual({ success: false, code: "invalid-credentials" });
    expect(repository.lookupAccount).toHaveBeenCalledOnce();
    expect(repository.applyRateLimit).toHaveBeenCalledTimes(4);
    expect(repository.recordLoginFailure).not.toHaveBeenCalled();
    expect(repository.createSession).not.toHaveBeenCalled();
  });

  it("records a known-account failure without changing the public response", async () => {
    const repository = makeRepository();
    vi.mocked(repository.lookupAccount).mockResolvedValue(
      await activeLoginAccount(),
    );
    const service = makeService(repository);

    const result = await service.signIn({
      employeeNumber: "TEST-1001",
      passcode: "WrongHorse9",
      deviceId: "fictional-device",
      networkId: "198.51.100.10",
    });

    expect(result).toEqual({ success: false, code: "invalid-credentials" });
    expect(repository.recordLoginFailure).toHaveBeenCalledWith(
      ACCOUNT_ID,
      5,
      900,
    );
    expect(repository.createSession).not.toHaveBeenCalled();
  });

  it("applies every abuse-control dimension before returning a rate limit", async () => {
    const repository = makeRepository();
    vi.mocked(repository.applyRateLimit).mockImplementation(async (subject) => ({
      allowed: subject !== "network",
      retryAfterSeconds: subject === "network" ? 321 : 0,
    }));
    const service = makeService(repository);

    const result = await service.signIn({
      employeeNumber: "TEST-1001",
      passcode: "CorrectHorse9",
      deviceId: "fictional-device",
      networkId: "198.51.100.10",
    });

    expect(result).toEqual({
      success: false,
      code: "rate-limited",
      retryAfterSeconds: 321,
    });
    expect(repository.applyRateLimit).toHaveBeenCalledTimes(4);
    expect(repository.lookupAccount).not.toHaveBeenCalled();
  });

  it("refreshes a valid session without rotating it before 30 minutes", async () => {
    const repository = makeRepository();
    const issued = issueOpaqueToken();
    vi.mocked(repository.resolveSession).mockResolvedValue(
      storedSession({
        sessionId: issued.id,
        secretHash: hashOpaqueSecret(issued.secret, SECRETS.sessionHmacKey),
        rotatedAt: new Date(NOW.getTime() - 10 * 60 * 1000),
      }),
    );
    const service = makeService(repository);

    const result = await service.resolveSession(issued.serialized);

    expect(result?.replacementSessionToken).toBeNull();
    expect(result?.account.accountId).toBe(ACCOUNT_ID);
    expect(result?.csrfToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(repository.refreshSession).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: issued.id,
        newSecretHash: null,
      }),
    );
  });

  it("rotates a valid current secret after 30 minutes", async () => {
    const repository = makeRepository();
    const issued = issueOpaqueToken();
    vi.mocked(repository.resolveSession).mockResolvedValue(
      storedSession({
        sessionId: issued.id,
        secretHash: hashOpaqueSecret(issued.secret, SECRETS.sessionHmacKey),
        rotatedAt: new Date(NOW.getTime() - 31 * 60 * 1000),
      }),
    );
    vi.mocked(repository.refreshSession).mockResolvedValue({
      accepted: true,
      rotated: true,
      absoluteExpiresAt: new Date(NOW.getTime() + 6 * 60 * 60 * 1000),
    });
    const service = makeService(repository);

    const result = await service.resolveSession(issued.serialized);

    expect(result?.replacementSessionToken).toMatch(
      new RegExp(`^${issued.id}\\.[A-Za-z0-9_-]{43}$`),
    );
    expect(result?.replacementSessionToken).not.toBe(issued.serialized);
    expect(repository.refreshSession).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: issued.id,
        newSecretHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    );
  });

  it("rejects revoked, stale-version, and malformed sessions", async () => {
    const repository = makeRepository();
    const issued = issueOpaqueToken();
    vi.mocked(repository.resolveSession).mockResolvedValue(
      storedSession({
        sessionId: issued.id,
        secretHash: hashOpaqueSecret(issued.secret, SECRETS.sessionHmacKey),
        revokedAt: NOW,
      }),
    );
    const service = makeService(repository);

    await expect(service.resolveSession("invalid")).resolves.toBeNull();
    await expect(service.resolveSession(issued.serialized)).resolves.toBeNull();
    expect(repository.refreshSession).not.toHaveBeenCalled();
  });

  it("revokes the presented opaque session on sign out", async () => {
    const repository = makeRepository();
    const issued = issueOpaqueToken();
    const service = makeService(repository);

    await service.signOut(issued.serialized);

    expect(repository.revokeSession).toHaveBeenCalledWith(
      issued.id,
      hashOpaqueSecret(issued.secret, SECRETS.sessionHmacKey),
      "user-logout",
    );
  });
});

function storedSession(overrides: Partial<StoredSession> = {}): StoredSession {
  return {
    sessionId: "33333333-3333-4333-8333-333333333333",
    accountId: ACCOUNT_ID,
    secretHash: "b".repeat(64),
    previousSecretHash: null,
    previousValidUntil: null,
    sessionAuthVersion: 1,
    accountAuthVersion: 1,
    role: "officer",
    status: "active",
    mustChangePasscode: false,
    rotatedAt: new Date(NOW.getTime() - 5 * 60 * 1000),
    idleExpiresAt: new Date(NOW.getTime() + 60 * 60 * 1000),
    absoluteExpiresAt: new Date(NOW.getTime() + 12 * 60 * 60 * 1000),
    adminElevatedUntil: null,
    revokedAt: null,
    ...overrides,
  };
}
