import "server-only";
import type { Database } from "@devhub/database";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requireSupabaseEnv } from "@/env";

/**
 * User-scoped Supabase client for Server Components, Server Actions and Route
 * Handlers. Every query runs as the signed-in user, so RLS applies.
 */
export async function createSupabaseServerClient() {
  // Read cookies first: it marks every caller as dynamic (per-user) before anything can throw at build time.
  const cookieStore = await cookies();
  const env = requireSupabaseEnv();
  return createServerClient<Database>(env.supabaseUrl, env.supabasePublishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Server Components cannot set cookies; the proxy refreshes sessions instead.
        }
      },
    },
  });
}

export type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;
