import "server-only";

import { z } from "zod";

const authServerEnvironment = z.object({
  SUPABASE_SECRET_KEY: z.string().min(1),
  SUPABASE_DB_URL: z.string().url(),
  EMPLOYEE_LOOKUP_PEPPER: z.string().min(32),
  AUTH_DUMMY_ALIAS: z.string().email(),
  CSRF_HMAC_KEY: z.string().min(32),
  AUTH_SIGN_IN_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
});

export type AuthServerEnvironment = z.infer<typeof authServerEnvironment>;

/**
 * Secrets used only by server-side auth adapters. No fallback is allowed:
 * accepting an empty value would weaken keyed lookup or CSRF binding.
 */
export function getAuthServerEnvironment(
  environment: Record<string, string | undefined> = process.env,
): AuthServerEnvironment {
  return authServerEnvironment.parse({
    SUPABASE_SECRET_KEY: environment.SUPABASE_SECRET_KEY,
    SUPABASE_DB_URL: environment.SUPABASE_DB_URL,
    EMPLOYEE_LOOKUP_PEPPER: environment.EMPLOYEE_LOOKUP_PEPPER,
    AUTH_DUMMY_ALIAS: environment.AUTH_DUMMY_ALIAS,
    CSRF_HMAC_KEY: environment.CSRF_HMAC_KEY,
    AUTH_SIGN_IN_ENABLED: environment.AUTH_SIGN_IN_ENABLED,
  });
}
