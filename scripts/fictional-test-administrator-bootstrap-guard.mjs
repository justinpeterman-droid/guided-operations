export const FICTIONAL_TEST_BOOTSTRAP_CONFIRMATION =
  "--confirm-fictional-test-administrator";
export const FICTIONAL_TEST_ROTATION_CONFIRMATION =
  "--rotate-fictional-test-administrator";
export const GUIDED_OPERATIONS_DEVELOPMENT_PROJECT_REF = "mfkunfqhosmrjbreythc";
export const GUIDED_OPERATIONS_LOCAL_ORIGIN = "http://127.0.0.1:3109";

export function validateFictionalTestBootstrapRequest({ argv, environment }) {
  validateFictionalTestAdministratorEnvironment(
    { argv, environment },
    {
      confirmation: FICTIONAL_TEST_BOOTSTRAP_CONFIRMATION,
      action: "bootstrap",
      requiresLocalSessionFlow: false,
    },
  );
}

export function validateFictionalTestRotationRequest({ argv, environment }) {
  validateFictionalTestAdministratorEnvironment(
    { argv, environment },
    {
      confirmation: FICTIONAL_TEST_ROTATION_CONFIRMATION,
      action: "passcode rotation",
      requiresLocalSessionFlow: true,
    },
  );
}

function validateFictionalTestAdministratorEnvironment(
  { argv, environment },
  { confirmation, action, requiresLocalSessionFlow },
) {
  if (argv.length !== 1 || argv[0] !== confirmation) {
    throw new Error(`Fictional test ${action} requires ${confirmation}.`);
  }

  if (environment.APP_ENV !== "development") {
    throw new Error(
      `Fictional test ${action} is restricted to APP_ENV=development.`,
    );
  }

  const apiUrl = parseUrl(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    "A Supabase project URL is required.",
  );
  if (
    apiUrl.protocol !== "https:" ||
    apiUrl.hostname !==
      `${GUIDED_OPERATIONS_DEVELOPMENT_PROJECT_REF}.supabase.co`
  ) {
    throw new Error(
      "Fictional administrator work is restricted to the Guided Operations Development project.",
    );
  }

  if (!environment.SUPABASE_SECRET_KEY?.trim()) {
    throw new Error("A server-only Supabase key is required.");
  }

  const databaseUrl = parseUrl(
    environment.SUPABASE_DB_URL,
    "A private Supabase database URL is required.",
  );
  const decodedDatabaseUser = decodeURIComponent(databaseUrl.username);
  const targetsDevelopmentProject =
    databaseUrl.hostname.includes(GUIDED_OPERATIONS_DEVELOPMENT_PROJECT_REF) ||
    decodedDatabaseUser.endsWith(
      `.${GUIDED_OPERATIONS_DEVELOPMENT_PROJECT_REF}`,
    );
  if (
    !["postgres:", "postgresql:"].includes(databaseUrl.protocol) ||
    databaseUrl.pathname !== "/postgres" ||
    !targetsDevelopmentProject
  ) {
    throw new Error(
      "The private database URL does not target Guided Operations Development.",
    );
  }

  if (!requiresLocalSessionFlow) return;

  if (environment.APP_ORIGIN !== GUIDED_OPERATIONS_LOCAL_ORIGIN) {
    throw new Error(
      `Fictional administrator rotation requires APP_ORIGIN=${GUIDED_OPERATIONS_LOCAL_ORIGIN}.`,
    );
  }
  if (!environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()) {
    throw new Error("A Supabase publishable key is required.");
  }
  if ((environment.EMPLOYEE_LOOKUP_PEPPER?.trim().length ?? 0) < 32) {
    throw new Error("A valid employee lookup pepper is required.");
  }
  if (!environment.AUTH_SESSION_ENCRYPTION_KEY?.trim()) {
    throw new Error("An encrypted-session key is required.");
  }
}

function parseUrl(value, missingMessage) {
  if (!value?.trim()) {
    throw new Error(missingMessage);
  }
  try {
    return new URL(value);
  } catch {
    throw new Error(missingMessage);
  }
}
