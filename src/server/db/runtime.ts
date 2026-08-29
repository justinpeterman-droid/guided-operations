import "server-only";

import postgres from "postgres";
import { z } from "zod";

import { getAuthServerEnvironment } from "@/lib/env/auth-server";

const accountIdSchema = z.uuid();

type TransactionSql = postgres.TransactionSql<Record<string, never>>;

let applicationDatabase: postgres.Sql | undefined;

function getApplicationDatabase(): postgres.Sql {
  if (applicationDatabase) {
    return applicationDatabase;
  }

  const environment = getAuthServerEnvironment();
  applicationDatabase = postgres(environment.APP_DATABASE_URL, {
    max: 4,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
  });

  return applicationDatabase;
}

export async function withPreAuthDb<T>(
  operation: (sql: TransactionSql) => Promise<T>,
): Promise<T> {
  const database = getApplicationDatabase();

  return database.begin(async (sql) => {
    await sql.unsafe("set local role guided_operations_preauth");
    return operation(sql);
  });
}

export async function withRuntimeDb<T>(
  accountId: string,
  operation: (sql: TransactionSql) => Promise<T>,
): Promise<T> {
  const verifiedAccountId = accountIdSchema.parse(accountId);
  const database = getApplicationDatabase();

  return database.begin(async (sql) => {
    await sql.unsafe("set local role guided_operations_runtime");
    await sql`
      select set_config(
        'app.current_account_id',
        ${verifiedAccountId},
        true
      )
    `;
    return operation(sql);
  });
}

export async function closeApplicationDatabase(): Promise<void> {
  if (!applicationDatabase) {
    return;
  }

  const database = applicationDatabase;
  applicationDatabase = undefined;
  await database.end({ timeout: 5 });
}
