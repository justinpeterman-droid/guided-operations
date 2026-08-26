import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { getPublicSupabaseEnvironment } from "@/lib/env/supabase-public";

/**
 * Refreshes verified Supabase Auth claims at the request boundary. Server
 * Components receive the refreshed request cookies and the browser receives
 * matching response cookies. Callers must still recheck app_private account
 * status and auth_version before authorizing an operation.
 */
export async function refreshSupabaseSession(request: NextRequest) {
  const environment = getPublicSupabaseEnvironment();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }

          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  await supabase.auth.getClaims();
  return response;
}
