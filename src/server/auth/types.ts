export type AccountRole = "officer" | "administrator";
export type AccountStatus = "pending" | "active" | "locked" | "disabled";
export type RateLimitSubject = "account" | "device" | "network" | "global";

export interface LoginAccount {
  accountId: string;
  staffMemberId: string;
  passcodeHash: string;
  role: AccountRole;
  status: AccountStatus;
  mustChangePasscode: boolean;
  failedAttempts: number;
  lockedUntil: Date | null;
  authVersion: number;
  temporaryExpiresAt: Date | null;
}

export interface StoredSession {
  sessionId: string;
  accountId: string;
  secretHash: string;
  previousSecretHash: string | null;
  previousValidUntil: Date | null;
  sessionAuthVersion: number;
  accountAuthVersion: number;
  role: AccountRole;
  status: AccountStatus;
  mustChangePasscode: boolean;
  rotatedAt: Date;
  idleExpiresAt: Date;
  absoluteExpiresAt: Date;
  adminElevatedUntil: Date | null;
  revokedAt: Date | null;
}

export interface CurrentAccount {
  accountId: string;
  staffMemberId: string;
  displayName: string;
  employeeNumberHint: string;
  employeeLookupHash: string;
  role: AccountRole;
  status: AccountStatus;
  mustChangePasscode: boolean;
  authVersion: number;
}

export interface RefreshSessionResult {
  accepted: boolean;
  rotated: boolean;
  absoluteExpiresAt: Date | null;
}

export interface AuthRepository {
  lookupAccount(employeeLookupHash: string): Promise<LoginAccount | null>;
  applyRateLimit(
    subjectType: RateLimitSubject,
    subjectHash: string,
    limit: number,
    windowSeconds: number,
    blockSeconds: number,
  ): Promise<{ allowed: boolean; retryAfterSeconds: number }>;
  recordLoginFailure(
    accountId: string,
    lockAfter: number,
    lockSeconds: number,
  ): Promise<void>;
  createSession(input: {
    sessionId: string;
    accountId: string;
    expectedAuthVersion: number;
    secretHash: string;
    deviceHash: string;
    networkHash: string;
    idleExpiresAt: Date;
    absoluteExpiresAt: Date;
  }): Promise<boolean>;
  resolveSession(sessionId: string): Promise<StoredSession | null>;
  refreshSession(input: {
    sessionId: string;
    presentedHash: string;
    newSecretHash: string | null;
    newIdleExpiresAt: Date;
  }): Promise<RefreshSessionResult>;
  revokeSession(
    sessionId: string,
    presentedHash: string,
    reason: string,
  ): Promise<boolean>;
  loadCurrentAccount(accountId: string): Promise<CurrentAccount | null>;
  changePasscode(
    accountId: string,
    passcodeHash: string,
    expectedAuthVersion: number,
  ): Promise<number | null>;
  revokeAllSessions(accountId: string, reason: string): Promise<number | null>;
}
