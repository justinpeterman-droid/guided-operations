import "server-only";

import { cookies } from "next/headers";

import { SESSION_COOKIE_NAME } from "./http";
import { getServerAuthService, isAuthServerConfigured } from "./server";
import type { ResolvedSession } from "./service";

export async function getCurrentSession(): Promise<ResolvedSession | null> {
  if (!isAuthServerConfigured()) {
    return null;
  }

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken) {
    return null;
  }

  try {
    return await getServerAuthService().resolveSession(sessionToken, {
      rotate: false,
    });
  } catch {
    return null;
  }
}
