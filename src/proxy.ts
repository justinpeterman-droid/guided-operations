import { NextResponse, type NextRequest } from "next/server";

import { refreshSupabaseSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  // These pages are deliberately public, fictional review surfaces. Skipping
  // session refresh here lets local visual review work without pretending that
  // missing Supabase configuration authorizes any protected application route.
  if (
    request.nextUrl.pathname === "/" ||
    request.nextUrl.pathname === "/login" ||
    request.nextUrl.pathname.startsWith("/preview/") ||
    request.nextUrl.pathname.startsWith("/api/health/")
  ) {
    return NextResponse.next();
  }
  return refreshSupabaseSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
