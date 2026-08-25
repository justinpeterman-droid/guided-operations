import "server-only";

import { z } from "zod";

const rawRuntimeEnvironmentSchema = z.object({
  APP_ENV: z.enum(["development", "preview", "production", "test"]),
  APP_ORIGIN: z.string().optional(),
  VERCEL_URL: z.string().optional(),
});

const originSchema = z.url().transform((value, context) => {
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
});

export type RuntimeEnvironment = {
  APP_ENV: "development" | "preview" | "production" | "test";
  APP_ORIGIN: string;
};

export function getRuntimeEnvironment(
  environment: Record<string, string | undefined> = process.env,
): RuntimeEnvironment {
  const rawEnvironment = rawRuntimeEnvironmentSchema.parse({
    APP_ENV: environment.APP_ENV,
    APP_ORIGIN: environment.APP_ORIGIN,
    VERCEL_URL: environment.VERCEL_URL,
  });
  const previewOrigin =
    rawEnvironment.APP_ENV === "preview" && rawEnvironment.VERCEL_URL
      ? `https://${rawEnvironment.VERCEL_URL}`
      : undefined;
  const appOrigin = rawEnvironment.APP_ORIGIN ?? previewOrigin;

  if (!appOrigin) {
    throw new Error(
      "APP_ORIGIN is required outside a Vercel Preview deployment.",
    );
  }

  const origin = originSchema.parse(appOrigin);
  if (
    rawEnvironment.APP_ENV === "production" &&
    !origin.startsWith("https://")
  ) {
    throw new Error("Production APP_ORIGIN must use HTTPS.");
  }

  return {
    APP_ENV: rawEnvironment.APP_ENV,
    APP_ORIGIN: origin,
  };
}
