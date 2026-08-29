import "server-only";

import { z } from "zod";

const hmacSecret = z.string().min(32);

const authServerEnvironment = z.object({
  APP_DATABASE_URL: z.string().url().refine(
    (value) => value.startsWith("postgres://") || value.startsWith("postgresql://"),
    "APP_DATABASE_URL must be a PostgreSQL URL",
  ),
  APP_ORIGIN: z.string().url().refine(
    (value) => value.startsWith("https://") || value.startsWith("http://localhost") || value.startsWith("http://127.0.0.1"),
    "APP_ORIGIN must use HTTPS outside local development",
  ),
  EMPLOYEE_LOOKUP_PEPPER: hmacSecret,
  AUTH_SESSION_HMAC_KEY: hmacSecret,
  AUTH_DEVICE_HMAC_KEY: hmacSecret,
  AUTH_NETWORK_HMAC_KEY: hmacSecret,
  AUTH_CSRF_HMAC_KEY: hmacSecret,
});

export type AuthServerEnvironment = z.infer<typeof authServerEnvironment>;

export function getAuthServerEnvironment(): AuthServerEnvironment {
  return authServerEnvironment.parse({
    APP_DATABASE_URL: process.env.APP_DATABASE_URL,
    APP_ORIGIN: process.env.APP_ORIGIN,
    EMPLOYEE_LOOKUP_PEPPER: process.env.EMPLOYEE_LOOKUP_PEPPER,
    AUTH_SESSION_HMAC_KEY: process.env.AUTH_SESSION_HMAC_KEY,
    AUTH_DEVICE_HMAC_KEY: process.env.AUTH_DEVICE_HMAC_KEY,
    AUTH_NETWORK_HMAC_KEY: process.env.AUTH_NETWORK_HMAC_KEY,
    AUTH_CSRF_HMAC_KEY: process.env.AUTH_CSRF_HMAC_KEY,
  });
}
