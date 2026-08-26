import "server-only";

import { z } from "zod";

const sessionClaimsSchema = z
  .object({
    sub: z.uuid(),
    app_metadata: z
      .object({ auth_version: z.number().int().positive() })
      .passthrough(),
  })
  .passthrough();

export type SessionAuthority = Readonly<{
  authUserId: string;
  authVersion: number;
}>;

/**
 * Extracts only the server-issued identity/version claims. The application
 * never accepts user_metadata as authorization data, and missing hook output
 * fails closed until the custom access-token hook is configured.
 */
export function parseSessionAuthority(
  claims: unknown,
): SessionAuthority | null {
  const parsed = sessionClaimsSchema.safeParse(claims);
  if (!parsed.success) return null;

  return {
    authUserId: parsed.data.sub,
    authVersion: parsed.data.app_metadata.auth_version,
  };
}
