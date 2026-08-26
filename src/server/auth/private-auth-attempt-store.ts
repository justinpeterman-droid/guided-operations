import "server-only";

import postgres from "postgres";

import { getAuthServerEnvironment } from "@/lib/env/auth-server";

import type {
  AuthAttemptOutcome,
  AuthAttemptStore,
  AuthAttemptSubject,
} from "./guarded-employee-sign-in";

type AttemptRow = Readonly<{ occurred_at_ms: number }>;

type AuthAttemptPersistence = Readonly<{
  listOccurredAt(
    subject: AuthAttemptSubject,
    since: Date,
  ): Promise<readonly number[]>;
  insert(
    subject: AuthAttemptSubject,
    outcome: AuthAttemptOutcome,
    expiresAt: Date,
  ): Promise<void>;
}>;

let privateAuthSql: ReturnType<typeof postgres> | undefined;

function getPrivateAuthSql(): ReturnType<typeof postgres> {
  if (privateAuthSql) return privateAuthSql;

  const environment = getAuthServerEnvironment();
  privateAuthSql = postgres(environment.SUPABASE_DB_URL, {
    max: 1,
    prepare: false,
    idle_timeout: 5,
  });
  return privateAuthSql;
}

function createPostgresAuthAttemptPersistence(): AuthAttemptPersistence {
  const sql = getPrivateAuthSql();

  return {
    async listOccurredAt(subject, since) {
      const rows = await sql<AttemptRow[]>`
        select (extract(epoch from occurred_at) * 1000)::bigint as occurred_at_ms
          from app_private.auth_attempt_events
         where subject_kind = ${subject.kind}
           and subject_digest = ${subject.digest}
           and occurred_at > ${since}
         order by occurred_at desc
      `;
      return rows.map((row) => Number(row.occurred_at_ms));
    },
    async insert(subject, outcome, expiresAt) {
      await sql`
        insert into app_private.auth_attempt_events (
          subject_kind,
          subject_digest,
          outcome,
          expires_at
        ) values (
          ${subject.kind},
          ${subject.digest},
          ${outcome},
          ${expiresAt}
        )
      `;
    },
  };
}

/**
 * Converts the narrow private persistence adapter into the auth service
 * contract. It never accepts or returns raw employee, device, or network
 * identifiers.
 */
export function createAuthAttemptStore(
  persistence: AuthAttemptPersistence = createPostgresAuthAttemptPersistence(),
): AuthAttemptStore {
  return {
    listOccurredAt(subject, since) {
      return persistence.listOccurredAt(subject, since);
    },
    async record(subjects, outcome, expiresAt) {
      await Promise.all(
        subjects.map((subject) =>
          persistence.insert(subject, outcome, expiresAt),
        ),
      );
    },
  };
}
