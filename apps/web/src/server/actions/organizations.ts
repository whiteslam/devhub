"use server";

import { createOrganizationInputSchema } from "@devhub/contracts";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { type ActionState, formText, fromAuthorizationError, fromDbError, fromZodError } from "../action-state";
import { ACTIVE_ORG_COOKIE, getMemberships, requirePermission, requireViewer, requireWorkspace } from "../session";

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
};

export async function createOrganization(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireViewer();
  const parsed = createOrganizationInputSchema.safeParse({ name: formText(formData, "name"), slug: formText(formData, "slug") });
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createSupabaseServerClient();
  const { data: id, error } = await supabase.rpc("create_organization", { p_name: parsed.data.name, p_slug: parsed.data.slug });
  if (error) return fromDbError(error, "slug");
  (await cookies()).set(ACTIVE_ORG_COOKIE, id, cookieOptions);
  redirect("/");
}

export async function switchOrganization(formData: FormData): Promise<void> {
  const id = formText(formData, "organizationId");
  const memberships = await getMemberships();
  // Only organizations the user belongs to can become active.
  if (memberships.some((m) => m.organization.id === id)) {
    (await cookies()).set(ACTIVE_ORG_COOKIE, id, cookieOptions);
  }
  redirect("/");
}

export async function renameOrganization(_: ActionState, formData: FormData): Promise<ActionState> {
  const workspace = await requireWorkspace();
  try {
    await requirePermission(workspace, "org:update");
  } catch (error) {
    return fromAuthorizationError(error);
  }
  const name = createOrganizationInputSchema.shape.name.safeParse(formText(formData, "name"));
  if (!name.success) return { ok: false, fieldErrors: { name: name.error.issues[0]?.message ?? "Invalid name." } };
  const { error } = await workspace.supabase.from("organizations").update({ name: name.data }).eq("id", workspace.organization.id);
  if (error) return fromDbError(error);
  revalidatePath("/", "layout");
  return { ok: true, message: "Organization renamed." };
}

const securitySchema = z.object({
  requireMfa: z.boolean(),
  retentionDays: z.coerce.number().int().min(1).max(400),
});

export async function updateOrganizationSecurity(_: ActionState, formData: FormData): Promise<ActionState> {
  const workspace = await requireWorkspace();
  // Owner-only and MFA-gated in the database; checked here first for a clear message.
  if (workspace.role !== "owner") return { ok: false, message: "Only owners can change security settings." };
  if (workspace.organization.require_mfa && workspace.viewer.aal !== "aal2") {
    return { ok: false, message: "Verify with your authenticator app before changing security settings." };
  }
  const parsed = securitySchema.safeParse({
    requireMfa: formData.get("requireMfa") === "on",
    retentionDays: formText(formData, "retentionDays"),
  });
  if (!parsed.success) return fromZodError(parsed.error);
  if (parsed.data.requireMfa && workspace.viewer.aal !== "aal2") {
    return { ok: false, message: "Enroll and verify an authenticator yourself before requiring MFA for everyone." };
  }
  const { error } = await workspace.supabase.rpc("update_organization_security", {
    p_org: workspace.organization.id,
    p_require_mfa: parsed.data.requireMfa,
    p_retention_days: parsed.data.retentionDays,
  });
  if (error) return fromDbError(error);
  revalidatePath("/", "layout");
  return { ok: true, message: "Security settings saved." };
}
