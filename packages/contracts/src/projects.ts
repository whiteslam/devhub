import { z } from "zod";
import { APP_TYPES, ENVIRONMENT_KINDS, FRAMEWORKS, HOSTING_PROVIDERS, RELEASE_STRATEGIES } from "./catalog";

/** Lowercase, URL-safe, 2–48 chars, no leading/trailing/double hyphens. Mirrors `app.is_valid_slug`. */
export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){1,47}$/;

export const slugSchema = z.string().trim().toLowerCase().regex(SLUG_PATTERN, "Use 2–48 lowercase letters, numbers and single hyphens.");

export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");
}

const optionalUrl = z
  .string()
  .trim()
  .max(2048)
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional()
  .refine((v) => v == null || isHttpUrl(v), "Enter a full http(s) URL.");

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export const environmentInputSchema = z.object({
  name: z.string().trim().min(1).max(64),
  slug: slugSchema,
  kind: z.enum(ENVIRONMENT_KINDS),
  baseUrl: optionalUrl,
});
export type EnvironmentInput = z.infer<typeof environmentInputSchema>;

export const DEFAULT_ENVIRONMENTS: EnvironmentInput[] = [
  { name: "Production", slug: "production", kind: "production", baseUrl: null },
  { name: "Staging", slug: "staging", kind: "staging", baseUrl: null },
  { name: "Development", slug: "development", kind: "development", baseUrl: null },
];

export const monitoringConfigSchema = z.object({
  uptimeEnabled: z.boolean().default(true),
  errorAlertsEnabled: z.boolean().default(true),
  /** Minutes without telemetry before the project is flagged as stale. */
  staleAfterMinutes: z.number().int().min(5).max(10080).default(60),
});
export type MonitoringConfig = z.infer<typeof monitoringConfigSchema>;

export const createProjectInputSchema = z
  .object({
    organizationId: z.uuid(),
    name: z.string().trim().min(2).max(80),
    slug: slugSchema,
    framework: z.enum(FRAMEWORKS),
    appType: z.enum(APP_TYPES),
    baseUrl: optionalUrl,
    repositoryUrl: optionalUrl,
    hostingProvider: z.enum(HOSTING_PROVIDERS),
    releaseStrategy: z.enum(RELEASE_STRATEGIES),
    monitoring: monitoringConfigSchema.default({
      uptimeEnabled: true,
      errorAlertsEnabled: true,
      staleAfterMinutes: 60,
    }),
    environments: z.array(environmentInputSchema).min(1).max(10).default(DEFAULT_ENVIRONMENTS),
  })
  .superRefine((value, ctx) => {
    const seen = new Set<string>();
    value.environments.forEach((env, index) => {
      if (seen.has(env.slug)) {
        ctx.addIssue({
          code: "custom",
          path: ["environments", index, "slug"],
          message: "Environment slugs must be unique.",
        });
      }
      seen.add(env.slug);
    });
    if (!value.environments.some((env) => env.kind === "production")) {
      ctx.addIssue({
        code: "custom",
        path: ["environments"],
        message: "At least one production environment is required.",
      });
    }
  });
export type CreateProjectInput = z.infer<typeof createProjectInputSchema>;

export const updateProjectInputSchema = z.object({
  projectId: z.uuid(),
  name: z.string().trim().min(2).max(80),
  framework: z.enum(FRAMEWORKS),
  appType: z.enum(APP_TYPES),
  baseUrl: optionalUrl,
  repositoryUrl: optionalUrl,
  hostingProvider: z.enum(HOSTING_PROVIDERS),
  releaseStrategy: z.enum(RELEASE_STRATEGIES),
});
export type UpdateProjectInput = z.infer<typeof updateProjectInputSchema>;

export const createOrganizationInputSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: slugSchema,
});
export type CreateOrganizationInput = z.infer<typeof createOrganizationInputSchema>;
