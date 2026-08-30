import "server-only";

import type { AuthRateLimitPolicy } from "@/features/auth/rate-limit";
import { getAuthServerEnvironment } from "@/lib/env/auth-server";

import type { GuardedSignInDependencies } from "./guarded-employee-sign-in";
import { createPrivateAuthAliasLookup } from "./private-alias-lookup";
import { createAuthAttemptStore } from "./private-auth-attempt-store";
import {
  createSupabasePasswordAuthenticator,
  type PasswordAuthenticator,
} from "./supabase-auth-adapters";

/**
 * Creates the server-only dependencies for employee-number authentication.
 * The threshold policy remains an explicit reviewed input: this factory has no
 * hidden production defaults and does not expose a browser-callable client.
 */
export async function createServerEmployeeSignInDependencies(
  policy: AuthRateLimitPolicy,
  passwordAuthenticator: PasswordAuthenticator | null = null,
): Promise<GuardedSignInDependencies> {
  const environment = getAuthServerEnvironment();

  return {
    policy,
    attemptStore: createAuthAttemptStore(),
    employeeSignIn: {
      employeeLookupHmacKey: environment.EMPLOYEE_LOOKUP_PEPPER,
      dummyAlias: environment.AUTH_DUMMY_ALIAS,
      aliasLookup: createPrivateAuthAliasLookup(),
      passwordAuthenticator:
        passwordAuthenticator ?? (await createSupabasePasswordAuthenticator()),
    },
  };
}
