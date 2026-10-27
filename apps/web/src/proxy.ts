import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { readSupabaseEnv } from "@/env";
import { isPublicPath } from "@/lib/routes";

/**
 * Runs before every page request:
 *  1. assigns a request id (propagated to logs and audit entries),
 *  2. refreshes the Supabase session cookie,
 *  3. sends signed-out visitors to /login.
 * This is a UX guard only; every page and action re-checks authorization.
 */
export async function proxy(request: NextRequest) {
  const incoming = request.headers.get("x-request-id");
  // Accept a caller's id only in a safe shape; it ends up in logs and audit rows.
  const requestId = incoming && /^[A-Za-z0-9._-]{8,100}$/.test(incoming) ? incoming : crypto.randomUUID();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);
  const { pathname, search } = request.nextUrl;

  const env = readSupabaseEnv();
  if (!env) {
    if (isPublicPath(pathname)) return withRequestId(NextResponse.next({ request: { headers: requestHeaders } }), requestId);
    return withRequestId(NextResponse.redirect(new URL("/setup", request.url)), requestId);
  }

  let response = NextResponse.next({ request: { headers: requestHeaders } });
  const supabase = createServerClient(env.supabaseUrl, env.supabasePublishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet, headers) => {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request: { headers: requestHeaders } });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
      },
    },
  });

  // getClaims() validates the JWT; do not trust getSession() on the server.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);

  if (!signedIn && !isPublicPath(pathname)) {
    const login = new URL("/login", request.url);
    if (pathname !== "/") login.searchParams.set("next", `${pathname}${search}`);
    return withRequestId(NextResponse.redirect(login), requestId);
  }
  if (signedIn && pathname === "/login") {
    return withRequestId(NextResponse.redirect(new URL("/", request.url)), requestId);
  }
  return withRequestId(response, requestId);
}

function withRequestId(response: NextResponse, requestId: string) {
  response.headers.set("x-request-id", requestId);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt).*)"],
};
