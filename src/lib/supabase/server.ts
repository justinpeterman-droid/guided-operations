import "server-only";

import { cookies } from "next/headers";

import { getAuthSessionEnvironment } from "@/lib/env/auth-session";
import { getRuntimeEnvironment } from "@/lib/env/runtime";
import { getPublicSupabaseEnvironment } from "@/lib/env/supabase-public";
import { createEncryptedSupabaseSessionStorage } from "@/server/auth/encrypted-supabase-session-storage";

import { createSupabaseSessionClient } from "./session-client";

export async function createSupabaseServerClient() {
  const environment = getPublicSupabaseEnvironment();
  const authSessionEnvironment = getAuthSessionEnvironment();
  const runtimeEnvironment = getRuntimeEnvironment();
  const cookieStore = await cookies();

  const storage = createEncryptedSupabaseSessionStorage({
    encryptionKey: authSessionEnvironment.AUTH_SESSION_ENCRYPTION_KEY,
    secure:
      runtimeEnvironment.APP_ENV !== "development" &&
      runtimeEnvironment.APP_ENV !== "test",
    cookies: {
      readAll: () => cookieStore.getAll(),
      writeAll: (changes) => {
        for (const { name, value, options } of changes) {
          cookieStore.set(name, value, options);
        }
      },
    },
  });

  return createSupabaseSessionClient(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    storage,
  );
}
