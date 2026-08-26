import "server-only";

import { z } from "zod";

const authServerEnvironment = z.object({
  SUPABASE_SECRET_KEY: z.string().min(1),
  EMPLOYEE_LOOKUP_PEPPER: z.string().min(32),
  AUTH_DUMMY_ALIAS: z.string().email(),
  CSRF_HMAC_KEY: z.string().min(32),
});

export type AuthServerEnvironment = z.infer<typeof authServerEnvironment>;

/**
 * Secrets used only by server-side auth adapters. No fallback is allowed:
 * accepting an empty value would weaken keyed lookup or CSRF binding.
 */
export function getAuthServerEnvironment(): AuthServerEnvironment {
  return authServerEnvironment.parse({
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    EMPLOYEE_LOOKUP_PEPPER: process.env.EMPLOYEE_LOOKUP_PEPPER,
    AUTH_DUMMY_ALIAS: process.env.AUTH_DUMMY_ALIAS,
    CSRF_HMAC_KEY: process.env.CSRF_HMAC_KEY,
  });
}
