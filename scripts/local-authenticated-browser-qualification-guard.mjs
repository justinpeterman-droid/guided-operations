export const LOCAL_BROWSER_QUALIFICATION_CONFIRMATION =
  "--confirm-local-guided-operations";

const EXPECTED_API_ORIGIN = "http://127.0.0.1:54321";

function requiredString(value) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * Fails closed before the qualification runner resets or writes any database.
 * Returned keys remain in process memory and must never be logged.
 */
export function validateLocalBrowserQualificationRequest({ argv, status }) {
  if (
    argv.length !== 1 ||
    argv[0] !== LOCAL_BROWSER_QUALIFICATION_CONFIRMATION
  ) {
    throw new Error(
      `Local browser qualification requires ${LOCAL_BROWSER_QUALIFICATION_CONFIRMATION}.`,
    );
  }

  const apiUrl = requiredString(status?.API_URL);
  const databaseUrl = requiredString(status?.DB_URL);
  const publishableKey =
    requiredString(status?.PUBLISHABLE_KEY) ?? requiredString(status?.ANON_KEY);
  const secretKey =
    requiredString(status?.SECRET_KEY) ??
    requiredString(status?.SERVICE_ROLE_KEY);

  if (!apiUrl || !databaseUrl || !publishableKey || !secretKey) {
    throw new Error("The complete local Supabase status is required.");
  }

  let parsedDatabaseUrl;
  try {
    parsedDatabaseUrl = new URL(databaseUrl);
  } catch {
    throw new Error("The local Supabase database target is invalid.");
  }

  if (
    apiUrl !== EXPECTED_API_ORIGIN ||
    parsedDatabaseUrl.protocol !== "postgresql:" ||
    parsedDatabaseUrl.hostname !== "127.0.0.1" ||
    parsedDatabaseUrl.port !== "54322" ||
    parsedDatabaseUrl.username !== "postgres" ||
    parsedDatabaseUrl.pathname !== "/postgres"
  ) {
    throw new Error(
      "Qualification is restricted to the expected local Supabase project.",
    );
  }

  return { apiUrl, databaseUrl, publishableKey, secretKey };
}
