"use server";

import { createProjectInputSchema, type EnvironmentInput, updateProjectInputSchema } from "@devhub/contracts";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { type ActionState, formText, fromAuthorizationError, fromDbError, fromZodError } from "../action-state";
import { requirePermission, requireWorkspace } from "../session";

const ENV_PRESETS: Record<string, EnvironmentInput> = {
  production: { name: "Production", slug: "production", kind: "production", baseUrl: null },
  staging: { name: "Staging", slug: "staging", kind: "staging", baseUrl: null },
  development: { name: "Development", slug: "development", kind: "development", baseUrl: null },
  preview: { name: "Preview", slug: "preview", kind: "preview", baseUrl: null },
};

export async function createProject(_: ActionState, formData: FormData): Promise<ActionState> {
  const workspace = await requireWorkspace();
  try {
    await requirePermission(workspace, "project:create");
  } catch (error) {
    return fromAuthorizationError(error);
  }

  const environments = formData
    .getAll("environments")
    .flatMap((value) => (typeof value === "string" && ENV_PRESETS[value] ? [ENV_PRESETS[value]] : []))
    .map((env) => (env.kind === "production" ? { ...env, baseUrl: formText(formData, "baseUrl") || null } : env));

  const parsed = createProjectInputSchema.safeParse({
    organizationId: workspace.organization.id,
    name: formText(formData, "name"),
    slug: formText(formData, "slug"),
    framework: formText(formData, "framework"),
    appType: formText(formData, "appType"),
    baseUrl: formText(formData, "baseUrl"),
    repositoryUrl: formText(formData, "repositoryUrl"),
    hostingProvider: formText(formData, "hostingProvider"),
    releaseStrategy: formText(formData, "releaseStrategy"),
    monitoring: {
      uptimeEnabled: formData.get("uptimeEnabled") === "on",
      errorAlertsEnabled: formData.get("errorAlertsEnabled") === "on",
      staleAfterMinutes: Number(formText(formData, "staleAfterMinutes") || 60),
    },
    environments,
  });
  if (!parsed.success) return fromZodError(parsed.error);
  const input = parsed.data;

  const { error } = await workspace.supabase.rpc("create_project", {
    p_organization_id: input.organizationId,
    p_project: {
      name: input.name,
      slug: input.slug,
      framework: input.framework,
      app_type: input.appType,
      base_url: input.baseUrl ?? null,
      repository_url: input.repositoryUrl ?? null,
      hosting_provider: input.hostingProvider,
      release_strategy: input.releaseStrategy,
      monitoring_config: input.monitoring,
      environments: input.environments.map((e) => ({ name: e.name, slug: e.slug, kind: e.kind, base_url: e.baseUrl ?? null })),
    },
  });
  if (error) return fromDbError(error, "slug");
  revalidatePath("/", "layout");
  redirect(`/projects/${input.slug}`);
}

export async function updateProject(_: ActionState, formData: FormData): Promise<ActionState> {
  const workspace = await requireWorkspace();
  const projectId = formText(formData, "projectId");
  try {
    await requirePermission(workspace, "project:update", projectId);
  } catch (error) {
    return fromAuthorizationError(error);
  }
  const parsed = updateProjectInputSchema.safeParse({
    projectId,
    name: formText(formData, "name"),
    framework: formText(formData, "framework"),
    appType: formText(formData, "appType"),
    baseUrl: formText(formData, "baseUrl"),
    repositoryUrl: formText(formData, "repositoryUrl"),
    hostingProvider: formText(formData, "hostingProvider"),
    releaseStrategy: formText(formData, "releaseStrategy"),
  });
  if (!parsed.success) return fromZodError(parsed.error);
  const p = parsed.data;
  const { data, error } = await workspace.supabase
    .from("projects")
    .update({
      name: p.name,
      framework: p.framework,
      app_type: p.appType,
      base_url: p.baseUrl ?? null,
      repository_url: p.repositoryUrl ?? null,
      hosting_provider: p.hostingProvider,
      release_strategy: p.releaseStrategy,
    })
    .eq("id", p.projectId)
    .select("id");
  if (error) return fromDbError(error);
  if (!data.length) return { ok: false, message: "Project not found, archived, or not editable by you." };
  revalidatePath("/", "layout");
  return { ok: true, message: "Project settings saved." };
}

export async function archiveProject(_: ActionState, formData: FormData): Promise<ActionState> {
  const workspace = await requireWorkspace();
  const projectId = formText(formData, "projectId");
  try {
    await requirePermission(workspace, "project:archive", projectId);
  } catch (error) {
    return fromAuthorizationError(error);
  }
  const { error } = await workspace.supabase.rpc("archive_project", {
    p_project_id: projectId,
    p_confirm_slug: formText(formData, "confirmSlug").trim(),
  });
  if (error) return fromDbError(error);
  revalidatePath("/", "layout");
  redirect("/projects?archived=1");
}
