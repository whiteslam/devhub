/** Paths reachable without a session. Everything else requires sign-in. */
const PUBLIC_PATHS = ["/login", "/auth/callback", "/setup", "/api/health"];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Only same-origin relative paths are accepted as post-login redirects. */
export function safeNextPath(value: string | null | undefined): string {
  if (!value?.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return "/";
  try {
    const url = new URL(value, "http://devhub.invalid");
    if (url.origin !== "http://devhub.invalid") return "/";
    return `${url.pathname}${url.search}`;
  } catch {
    return "/";
  }
}
