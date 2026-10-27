import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { safeNextPath } from "@/lib/routes";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { appOrigin } from "@/server/request";

/** Completes PKCE email-link and OAuth sign-ins. */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));
  // Redirect on the canonical origin, not nextUrl (which Next normalizes and proxies rewrite).
  const origin = appOrigin();
  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
  }
  return NextResponse.redirect(new URL("/login?error=link", origin));
}
