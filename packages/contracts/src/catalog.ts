/**
 * Closed vocabularies shared by the dashboard, the API and the database.
 * The database enforces the same lists with CHECK constraints
 * (supabase/migrations/*_projects.sql); change both together.
 */

export const FRAMEWORKS = [
  "nextjs",
  "react",
  "vue",
  "nuxt",
  "svelte",
  "astro",
  "remix",
  "node",
  "express",
  "fastify",
  "nestjs",
  "static",
  "other",
] as const;
export type Framework = (typeof FRAMEWORKS)[number];

export const FRAMEWORK_LABELS: Record<Framework, string> = {
  nextjs: "Next.js",
  react: "React (SPA)",
  vue: "Vue",
  nuxt: "Nuxt",
  svelte: "SvelteKit",
  astro: "Astro",
  remix: "Remix / React Router",
  node: "Node.js",
  express: "Express",
  fastify: "Fastify",
  nestjs: "NestJS",
  static: "Static site",
  other: "Other",
};

export const APP_TYPES = ["web_app", "api", "website", "worker", "mobile", "other"] as const;
export type AppType = (typeof APP_TYPES)[number];

export const APP_TYPE_LABELS: Record<AppType, string> = {
  web_app: "Web application",
  api: "API / backend",
  website: "Marketing website",
  worker: "Background worker",
  mobile: "Mobile app",
  other: "Other",
};

export const HOSTING_PROVIDERS = [
  "vercel",
  "coolify",
  "docker",
  "supabase",
  "netlify",
  "cloudflare",
  "aws",
  "self_hosted",
  "other",
] as const;
export type HostingProvider = (typeof HOSTING_PROVIDERS)[number];

export const HOSTING_PROVIDER_LABELS: Record<HostingProvider, string> = {
  vercel: "Vercel",
  coolify: "Coolify",
  docker: "Docker host",
  supabase: "Supabase",
  netlify: "Netlify",
  cloudflare: "Cloudflare",
  aws: "AWS",
  self_hosted: "Self-hosted",
  other: "Other",
};

export const RELEASE_STRATEGIES = ["git_sha", "semver", "build_id", "manual"] as const;
export type ReleaseStrategy = (typeof RELEASE_STRATEGIES)[number];

export const RELEASE_STRATEGY_LABELS: Record<ReleaseStrategy, string> = {
  git_sha: "Git commit SHA",
  semver: "Semantic version (package.json)",
  build_id: "Provider build / deployment ID",
  manual: "Set manually by the SDK",
};

export const ENVIRONMENT_KINDS = ["production", "staging", "development", "preview"] as const;
export type EnvironmentKind = (typeof ENVIRONMENT_KINDS)[number];

/**
 * pending   – registered, no verified telemetry yet
 * partial   – some (not all) required checks verified
 * connected – every required verification check passed
 * degraded  – was connected, telemetry is now stale or failing
 */
export const CONNECTION_STATUSES = ["pending", "partial", "connected", "degraded"] as const;
export type ConnectionStatus = (typeof CONNECTION_STATUSES)[number];
