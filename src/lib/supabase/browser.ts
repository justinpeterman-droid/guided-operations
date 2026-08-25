"use client";

import { createBrowserClient } from "@supabase/ssr";

import { getPublicSupabaseEnvironment } from "@/lib/env/supabase-public";

export function createSupabaseBrowserClient() {
  const environment = getPublicSupabaseEnvironment();

  return createBrowserClient(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
