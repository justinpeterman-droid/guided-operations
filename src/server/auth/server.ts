import "server-only";

import { getAuthServerEnvironment } from "@/lib/env/auth-server";

import { authRepository } from "./repository";
import { createAuthService } from "./service";

export function getServerAuthService() {
  const environment = getAuthServerEnvironment();

  return createAuthService({
    repository: authRepository,
    secrets: {
      employeeLookupPepper: environment.EMPLOYEE_LOOKUP_PEPPER,
      sessionHmacKey: environment.AUTH_SESSION_HMAC_KEY,
      deviceHmacKey: environment.AUTH_DEVICE_HMAC_KEY,
      networkHmacKey: environment.AUTH_NETWORK_HMAC_KEY,
      csrfHmacKey: environment.AUTH_CSRF_HMAC_KEY,
    },
  });
}

export function isAuthServerConfigured(): boolean {
  try {
    getAuthServerEnvironment();
    return true;
  } catch {
    return false;
  }
}
