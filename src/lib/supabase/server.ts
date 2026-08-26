import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getPublicSupabaseEnvironment } from "@/lib/env/supabase-public";

import type { Database } from "./database.generated";

export async function createSupabaseServerClient() {
  const environment = getPublicSupabaseEnvironment();
  const cookieStore = await cookies();

  return createServerClient<Database>(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Components cannot write cookies. The session proxy will own refreshes.
          }
        },
      },
    },
  );
}
