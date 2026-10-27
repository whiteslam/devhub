import {
  APP_TYPE_LABELS,
  APP_TYPES,
  FRAMEWORK_LABELS,
  FRAMEWORKS,
  HOSTING_PROVIDER_LABELS,
  HOSTING_PROVIDERS,
  RELEASE_STRATEGIES,
  RELEASE_STRATEGY_LABELS,
} from "@devhub/contracts";
import type { ProjectRow } from "@devhub/database";
import { Field, Input, Select } from "@devhub/ui";

/** Configuration fields shared by project registration and project settings. */
export function ProjectFields({ errors, project }: { errors?: Record<string, string> | undefined; project?: ProjectRow }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Framework" htmlFor="framework" error={errors?.framework}>
          <Select id="framework" name="framework" defaultValue={project?.framework ?? "nextjs"}>
            {FRAMEWORKS.map((f) => (
              <option key={f} value={f}>
                {FRAMEWORK_LABELS[f]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Application type" htmlFor="appType" error={errors?.appType}>
          <Select id="appType" name="appType" defaultValue={project?.app_type ?? "web_app"}>
            {APP_TYPES.map((t) => (
              <option key={t} value={t}>
                {APP_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Production URL" htmlFor="baseUrl" error={errors?.baseUrl} hint="Used for uptime checks and links.">
          <Input
            id="baseUrl"
            name="baseUrl"
            type="url"
            inputMode="url"
            placeholder="https://app.example.com"
            defaultValue={project?.base_url ?? ""}
          />
        </Field>
        <Field label="Repository" htmlFor="repositoryUrl" error={errors?.repositoryUrl} hint="Optional. Linked to GitHub in Phase 4.">
          <Input
            id="repositoryUrl"
            name="repositoryUrl"
            type="url"
            inputMode="url"
            placeholder="https://github.com/acme/storefront"
            defaultValue={project?.repository_url ?? ""}
          />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Hosting provider" htmlFor="hostingProvider" error={errors?.hostingProvider}>
          <Select id="hostingProvider" name="hostingProvider" defaultValue={project?.hosting_provider ?? "vercel"}>
            {HOSTING_PROVIDERS.map((h) => (
              <option key={h} value={h}>
                {HOSTING_PROVIDER_LABELS[h]}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Release identification"
          htmlFor="releaseStrategy"
          error={errors?.releaseStrategy}
          hint="How SDK events are tied to a release."
        >
          <Select id="releaseStrategy" name="releaseStrategy" defaultValue={project?.release_strategy ?? "git_sha"}>
            {RELEASE_STRATEGIES.map((r) => (
              <option key={r} value={r}>
                {RELEASE_STRATEGY_LABELS[r]}
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </>
  );
}
