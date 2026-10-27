import "server-only";
import { headers } from "next/headers";

/**
 * The client address as seen by the outermost trusted proxy. Each trusted
 * proxy appends to X-Forwarded-For, so the entry `hops` from the right is the
 * client; anything further left is client-supplied and ignored.
 */
export function pickClientIp(forwardedFor: string | null, hops: number): string | null {
  const chain = (forwardedFor ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (hops < 1 || chain.length < hops) return null;
  return chain[chain.length - hops] ?? null;
}

export async function clientKey(scope: string): Promise<string> {
  const h = await headers();
  const hops = Number.parseInt(process.env.DEVHUB_TRUSTED_PROXY_HOPS ?? "1", 10);
  const ip = pickClientIp(h.get("x-forwarded-for"), Number.isFinite(hops) ? hops : 1) ?? h.get("x-real-ip") ?? "unknown";
  return `${scope}:${ip}`;
}

/**
 * Canonical public origin for links and redirects. Never derived from request
 * headers (Host / X-Forwarded-Host are attacker-controllable), so auth emails
 * can only ever point at the configured origin.
 */
export function appOrigin(): string {
  const configured = process.env.DEVHUB_APP_URL;
  if (configured) return new URL(configured).origin;
  if (process.env.NODE_ENV === "production") throw new Error("DEVHUB_APP_URL must be set in production.");
  return "http://localhost:3000";
}
