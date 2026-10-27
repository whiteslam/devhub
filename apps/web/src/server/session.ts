import "server-only";
import {
  type AssuranceLevel,
  type AuthContext,
  AuthorizationError,
  assertAuthorized,
  isOrgRole,
  type OrgRole,
  type Permission,
  type ProjectRole,
} from "@devhub/auth";
import type { OrganizationRow } from "@devhub/database";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createSupabaseServerClient, type SupabaseServerClient } from "@/lib/supabase/server";

export const ACTIVE_ORG_COOKIE = "devhub_org";

export interface Viewer {
  userId: string;
  email: string;
  aal: AssuranceLevel;
}

export interface OrgMembership {
  organization: OrganizationRow;
  role: OrgRole;
}

export interface Workspace {
  supabase: SupabaseServerClient;
  viewer: Viewer;
  organization: OrganizationRow;
  role: OrgRole;
  memberships: OrgMembership[];
  /** Authorization context for org-level checks (no project grant). */
  auth: AuthContext;
}

/** The verified identity for this request, or null. Cached per request. */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) return null;
  return {
    userId: claims.sub,
    email: typeof claims.email === "string" ? claims.email : "",
    aal: claims.aal === "aal2" ? "aal2" : "aal1",
  };
});

export async function requireViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  return viewer;
}

/**
 * Number of verified MFA factors, from the Auth server. Never derive this from
 * the session cookie: its `user` object is unsigned and client-editable.
 */
export const verifiedFactorCount = cache(async (): Promise<number> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/login");
  return (data.user.factors ?? []).filter((f) => f.status === "verified").length;
});

/**
 * Users with an enrolled authenticator must complete the TOTP challenge
 * before using the dashboard, however they signed in (password or link).
 * The database enforces the same rule independently (app.aal_satisfied).
 */
export async function requireStepUp(): Promise<Viewer> {
  const viewer = await requireViewer();
  if (viewer.aal === "aal2") return viewer;
  if ((await verifiedFactorCount()) > 0) redirect("/login/mfa");
  return viewer;
}

export const getMemberships = cache(async (): Promise<OrgMembership[]> => {
  const viewer = await requireViewer();
  const supabase = await createSupabaseServerClient();
  const { data: rows, error } = await supabase.from("memberships").select("organization_id, role").eq("user_id", viewer.userId);
  if (error) throw new Error(`Failed to load memberships: ${error.message}`);
  if (!rows.length) return [];
  const { data: orgs, error: orgError } = await supabase
    .from("organizations")
    .select("*")
    .in(
      "id",
      rows.map((r) => r.organization_id),
    )
    .order("name");
  if (orgError) throw new Error(`Failed to load organizations: ${orgError.message}`);
  return orgs.flatMap((organization) => {
    const role = rows.find((r) => r.organization_id === organization.id)?.role;
    return role && isOrgRole(role) ? [{ organization, role }] : [];
  });
});

/** Signed-in user + active organization. Redirects to onboarding when the user has none. */
export const requireWorkspace = cache(async (): Promise<Workspace> => {
  const viewer = await requireStepUp();
  const memberships = await getMemberships();
  if (!memberships.length) redirect("/onboarding");
  const preferred = (await cookies()).get(ACTIVE_ORG_COOKIE)?.value;
  const active = memberships.find((m) => m.organization.id === preferred) ?? memberships[0];
  if (!active) redirect("/onboarding");
  // The organization requires MFA and this user has no factor yet (users with a
  // factor were already sent to the challenge): enrollment comes first.
  if (active.organization.require_mfa && viewer.aal !== "aal2") redirect("/mfa-setup");
  return {
    supabase: await createSupabaseServerClient(),
    viewer,
    organization: active.organization,
    role: active.role,
    memberships,
    auth: {
      userId: viewer.userId,
      organizationId: active.organization.id,
      orgRole: active.role,
      projectRole: null,
      aal: viewer.aal,
      orgRequiresMfa: active.organization.require_mfa,
    },
  };
});

export async function projectRoleFor(workspace: Workspace, projectId: string): Promise<ProjectRole | null> {
  const { data } = await workspace.supabase
    .from("project_members")
    .select("role")
    .eq("organization_id", workspace.organization.id)
    .eq("project_id", projectId)
    .eq("user_id", workspace.viewer.userId)
    .maybeSingle();
  return data?.role ?? null;
}

/**
 * Server-side authorization gate for privileged actions. Throws
 * AuthorizationError; the database re-checks the same rule independently.
 * A project outside the active organization is treated as not visible, so an
 * org role is never applied to another tenant's project.
 */
export async function requirePermission(workspace: Workspace, permission: Permission, projectId?: string): Promise<OrgRole> {
  if (!projectId) return assertAuthorized(workspace.auth, permission);
  const { data: project } = await workspace.supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("organization_id", workspace.organization.id)
    .maybeSingle();
  if (!project) throw new AuthorizationError(permission, "not_member");
  return assertAuthorized({ ...workspace.auth, projectRole: await projectRoleFor(workspace, projectId) }, permission);
}
