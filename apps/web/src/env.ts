import "server-only";
import { z } from "zod";

/**
 * Runtime server configuration. The browser never talks to Supabase directly
 * (auth and data go through Server Actions), so these are read at request
 * time rather than inlined at build time: one image serves every environment.
 * The publishable key is low-privilege by design (RLS enforces access). The
 * service-role key is deliberately absent: the dashboard never uses it.
 */
const supabaseEnvSchema = z.object({
  supabaseUrl: z.url(),
  supabasePublishableKey: z.string().min(20),
});

export type SupabaseEnv = z.infer<typeof supabaseEnvSchema>;

export function readSupabaseEnv(): SupabaseEnv | null {
  const parsed = supabaseEnvSchema.safeParse({
    supabaseUrl: process.env.SUPABASE_URL,
    supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY,
  });
  return parsed.success ? parsed.data : null;
}

export function requireSupabaseEnv(): SupabaseEnv {
  const env = readSupabaseEnv();
  if (!env) throw new Error("Supabase is not configured. See .env.example.");
  return env;
}

/** Self-service sign-up is off by default: DevHub is a private console. */
export function allowSignup(): boolean {
  return process.env.DEVHUB_ALLOW_SIGNUP === "true";
}

export function appVersion(): string {
  return process.env.DEVHUB_VERSION ?? "0.1.0-dev";
}
