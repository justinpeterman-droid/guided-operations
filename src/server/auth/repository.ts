import "server-only";

import { withPreAuthDb, withRuntimeDb } from "@/server/db/runtime";

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

type LoginAccountRow = {
  account_id: string;
  staff_member_id: string;
  passcode_hash: string;
  role: AccountRole;
  status: AccountStatus;
  must_change_passcode: boolean;
  failed_attempts: number;
  locked_until: Date | null;
  auth_version: number;
  temporary_expires_at: Date | null;
};

type StoredSessionRow = {
  session_id: string;
  account_id: string;
  secret_hash: string;
  previous_secret_hash: string | null;
  previous_valid_until: Date | null;
  session_auth_version: number;
  account_auth_version: number;
  role: AccountRole;
  status: AccountStatus;
  must_change_passcode: boolean;
  rotated_at: Date;
  idle_expires_at: Date;
  absolute_expires_at: Date;
  admin_elevated_until: Date | null;
  revoked_at: Date | null;
};

export const authRepository: AuthRepository = {
  async lookupAccount(employeeLookupHash) {
    return withPreAuthDb(async (sql) => {
      const [row] = await sql<[LoginAccountRow?]>`
        select *
        from app_private.preauth_lookup_account(${employeeLookupHash})
      `;

      return row ? mapLoginAccount(row) : null;
    });
  },

  async applyRateLimit(subjectType, subjectHash, limit, windowSeconds, blockSeconds) {
    return withPreAuthDb(async (sql) => {
      const [row] = await sql<[
        { allowed: boolean; retry_after_seconds: number }?,
      ]>`
        select *
        from app_private.preauth_rate_limit(
          ${subjectType},
          ${subjectHash},
          ${limit},
          ${windowSeconds},
          ${blockSeconds}
        )
      `;

      if (!row) {
        return { allowed: false, retryAfterSeconds: blockSeconds };
      }

      return {
        allowed: row.allowed,
        retryAfterSeconds: row.retry_after_seconds,
      };
    });
  },

  async recordLoginFailure(accountId, lockAfter, lockSeconds) {
    await withPreAuthDb(async (sql) => {
      await sql`
        select *
        from app_private.preauth_record_login_failure(
          ${accountId},
          ${lockAfter},
          ${lockSeconds}
        )
      `;
    });
  },

  async createSession(input) {
    return withPreAuthDb(async (sql) => {
      const [row] = await sql<[{ created: boolean }?]>`
        select app_private.preauth_create_session(
          ${input.sessionId},
          ${input.accountId},
          ${input.expectedAuthVersion},
          ${input.secretHash},
          ${input.deviceHash},
          ${input.networkHash},
          ${input.idleExpiresAt},
          ${input.absoluteExpiresAt}
        ) as created
      `;

      return row?.created ?? false;
    });
  },

  async resolveSession(sessionId) {
    return withPreAuthDb(async (sql) => {
      const [row] = await sql<[StoredSessionRow?]>`
        select *
        from app_private.preauth_resolve_session(${sessionId})
      `;

      return row ? mapStoredSession(row) : null;
    });
  },

  async refreshSession(input) {
    return withPreAuthDb(async (sql) => {
      const [row] = await sql<[
        {
          accepted: boolean;
          rotated: boolean;
          absolute_expires_at: Date | null;
        }?,
      ]>`
        select *
        from app_private.preauth_refresh_session(
          ${input.sessionId},
          ${input.presentedHash},
          ${input.newSecretHash},
          ${input.newIdleExpiresAt}
        )
      `;

      return {
        accepted: row?.accepted ?? false,
        rotated: row?.rotated ?? false,
        absoluteExpiresAt: row?.absolute_expires_at ?? null,
      };
    });
  },

  async revokeSession(sessionId, presentedHash, reason) {
    return withPreAuthDb(async (sql) => {
      const [row] = await sql<[{ revoked: boolean }?]>`
        select app_private.preauth_revoke_session(
          ${sessionId},
          ${presentedHash},
          ${reason}
        ) as revoked
      `;

      return row?.revoked ?? false;
    });
  },

  async loadCurrentAccount(accountId) {
    return withRuntimeDb(accountId, async (sql) => {
      const [row] = await sql<[
        {
          account_id: string;
          staff_member_id: string;
          display_name: string;
          employee_number_hint: string;
          employee_lookup_hash: string;
          role: AccountRole;
          status: AccountStatus;
          must_change_passcode: boolean;
          auth_version: number;
        }?,
      ]>`
        select
          account.id as account_id,
          staff.id as staff_member_id,
          staff.display_name,
          staff.employee_number_hint,
          staff.employee_lookup_hash,
          account.role,
          account.status,
          account.must_change_passcode,
          account.auth_version
        from app_private.user_accounts as account
        join app_private.staff_members as staff
          on staff.id = account.staff_member_id
        where account.id = app_private.current_account_id()
      `;

      if (!row) {
        return null;
      }

      return {
        accountId: row.account_id,
        staffMemberId: row.staff_member_id,
        displayName: row.display_name,
        employeeNumberHint: row.employee_number_hint,
        employeeLookupHash: row.employee_lookup_hash,
        role: row.role,
        status: row.status,
        mustChangePasscode: row.must_change_passcode,
        authVersion: row.auth_version,
      };
    });
  },

  async changePasscode(accountId, passcodeHash, expectedAuthVersion) {
    return withRuntimeDb(accountId, async (sql) => {
      const [row] = await sql<[{ next_auth_version: number | null }?]>`
        select app_private.runtime_change_passcode(
          ${passcodeHash},
          ${expectedAuthVersion}
        ) as next_auth_version
      `;

      return row?.next_auth_version ?? null;
    });
  },

  async revokeAllSessions(accountId, reason) {
    return withRuntimeDb(accountId, async (sql) => {
      const [row] = await sql<[{ next_auth_version: number | null }?]>`
        select app_private.runtime_revoke_all_sessions(${reason})
          as next_auth_version
      `;

      return row?.next_auth_version ?? null;
    });
  },
};

function mapLoginAccount(row: LoginAccountRow): LoginAccount {
  return {
    accountId: row.account_id,
    staffMemberId: row.staff_member_id,
    passcodeHash: row.passcode_hash,
    role: row.role,
    status: row.status,
    mustChangePasscode: row.must_change_passcode,
    failedAttempts: row.failed_attempts,
    lockedUntil: row.locked_until,
    authVersion: row.auth_version,
    temporaryExpiresAt: row.temporary_expires_at,
  };
}

function mapStoredSession(row: StoredSessionRow): StoredSession {
  return {
    sessionId: row.session_id,
    accountId: row.account_id,
    secretHash: row.secret_hash,
    previousSecretHash: row.previous_secret_hash,
    previousValidUntil: row.previous_valid_until,
    sessionAuthVersion: row.session_auth_version,
    accountAuthVersion: row.account_auth_version,
    role: row.role,
    status: row.status,
    mustChangePasscode: row.must_change_passcode,
    rotatedAt: row.rotated_at,
    idleExpiresAt: row.idle_expires_at,
    absoluteExpiresAt: row.absolute_expires_at,
    adminElevatedUntil: row.admin_elevated_until,
    revokedAt: row.revoked_at,
  };
}
