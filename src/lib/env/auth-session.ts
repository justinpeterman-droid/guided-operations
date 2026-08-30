import "server-only";

import { z } from "zod";

const authSessionEnvironment = z.object({
  AUTH_SESSION_ENCRYPTION_KEY: z
    .string()
    .regex(
      /^[A-Za-z0-9_-]{43}$/,
      "AUTH_SESSION_ENCRYPTION_KEY must be a base64url-encoded 32-byte key",
    )
    .refine(
      (value) =>
        Buffer.from(value, "base64url").toString("base64url") === value,
      "AUTH_SESSION_ENCRYPTION_KEY must use canonical base64url encoding",
    ),
});

export type AuthSessionEnvironment = z.infer<typeof authSessionEnvironment>;

/** Dedicated key for the encrypted server-managed Supabase session cookie. */
export function getAuthSessionEnvironment(
  environment: Record<string, string | undefined> = process.env,
): AuthSessionEnvironment {
  return authSessionEnvironment.parse({
    AUTH_SESSION_ENCRYPTION_KEY: environment.AUTH_SESSION_ENCRYPTION_KEY,
  });
}
