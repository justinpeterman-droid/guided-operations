import "server-only";

import { z } from "zod";

const runtimeEnvironmentSchema = z.object({
  APP_ENV: z.enum(["development", "preview", "production", "test"]),
  APP_ORIGIN: z.url().transform((value, context) => {
    const parsed = new URL(value);

    if (parsed.pathname !== "/" || parsed.search || parsed.hash) {
      context.addIssue({
        code: "custom",
        message:
          "APP_ORIGIN must be an origin without a path, query, or fragment",
      });
      return z.NEVER;
    }

    return parsed.origin;
  }),
});

export type RuntimeEnvironment = z.infer<typeof runtimeEnvironmentSchema>;

export function getRuntimeEnvironment(
  environment: Record<string, string | undefined> = process.env,
): RuntimeEnvironment {
  return runtimeEnvironmentSchema.parse({
    APP_ENV: environment.APP_ENV,
    APP_ORIGIN: environment.APP_ORIGIN,
  });
}
