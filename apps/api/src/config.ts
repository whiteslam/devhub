import { z } from "zod";

const schema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DEVHUB_VERSION: z.string().default("0.1.0-dev"),
  /** Base URL of the Supabase project, used by the readiness probe. */
  SUPABASE_URL: z.url().optional(),
  /** Maximum accepted request body; ingestion batches are bounded (Phase 2). */
  MAX_BODY_BYTES: z.coerce
    .number()
    .int()
    .min(1024)
    .max(5 * 1024 * 1024)
    .default(512 * 1024),
  REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60_000).default(10_000),
});

export type ApiConfig = z.infer<typeof schema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  return schema.parse(env);
}
