/**
 * DevHub permission model.
 *
 * Roles never imply "everything". Every role, including owner, is an explicit
 * list of permissions, and every privileged server action checks one named
 * permission through `authorize`. The SQL helpers in
 * supabase/migrations/*_foundation.sql (`app.has_org_role`) encode the same
 * role ladders for RLS; keep them in sync.
 */

export const ORG_ROLES = ["owner", "admin", "operator", "developer", "viewer"] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

/** Roles that can be granted on a single project to elevate an org member there. */
export const PROJECT_ROLES = ["admin", "operator", "developer", "viewer"] as const;
export type ProjectRole = (typeof PROJECT_ROLES)[number];

export const ROLE_LABELS: Record<OrgRole, string> = {
  owner: "Owner",
  admin: "Admin",
  operator: "Operator",
  developer: "Developer",
  viewer: "Viewer",
};

export const ROLE_DESCRIPTIONS: Record<OrgRole, string> = {
  owner: "Full control, including billing, ownership transfer and destructive actions.",
  admin: "Manages projects, members, credentials and integrations.",
  operator: "Runs operational actions such as deployments and rollbacks.",
  developer: "Reads everything operational and manages issues and alert rules.",
  viewer: "Read-only access to dashboards.",
};

export const PERMISSIONS = [
  // read
  "org:read",
  "project:read",
  "telemetry:read",
  "members:read",
  "audit:read",
  "billing:read",
  "credentials:read",
  // configuration writes
  "org:update",
  "members:manage",
  "project:create",
  "project:update",
  "project:archive",
  "credentials:manage",
  "integrations:manage",
  "alerts:manage",
  "issues:triage",
  "billing:manage",
  // operational writes
  "deploy:execute",
  "deploy:rollback",
  // destructive
  "org:delete",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

/**
 * Permissions that change production systems or are hard to undo. They need a
 * second authentication factor (AAL2) when the organization requires MFA, and
 * explicit user confirmation in the UI.
 */
export const SENSITIVE_PERMISSIONS: ReadonlySet<Permission> = new Set<Permission>([
  "project:archive",
  "credentials:manage",
  "integrations:manage",
  "members:manage",
  "billing:manage",
  "deploy:execute",
  "deploy:rollback",
  "org:delete",
]);

const READ: Permission[] = ["org:read", "project:read", "telemetry:read", "members:read"];

export const ROLE_PERMISSIONS: Record<OrgRole, ReadonlySet<Permission>> = {
  viewer: new Set<Permission>([...READ]),
  developer: new Set<Permission>([...READ, "credentials:read", "issues:triage", "alerts:manage"]),
  operator: new Set<Permission>([...READ, "credentials:read", "issues:triage", "alerts:manage", "deploy:execute", "deploy:rollback"]),
  admin: new Set<Permission>([
    ...READ,
    "audit:read",
    "credentials:read",
    "org:update",
    "members:manage",
    "project:create",
    "project:update",
    "project:archive",
    "credentials:manage",
    "integrations:manage",
    "alerts:manage",
    "issues:triage",
    "deploy:execute",
    "deploy:rollback",
  ]),
  owner: new Set<Permission>([
    ...READ,
    "audit:read",
    "billing:read",
    "credentials:read",
    "org:update",
    "members:manage",
    "project:create",
    "project:update",
    "project:archive",
    "credentials:manage",
    "integrations:manage",
    "alerts:manage",
    "issues:triage",
    "billing:manage",
    "deploy:execute",
    "deploy:rollback",
    "org:delete",
  ]),
};

const RANK: Record<OrgRole, number> = { viewer: 1, developer: 2, operator: 3, admin: 4, owner: 5 };

export function roleRank(role: OrgRole | ProjectRole): number {
  return RANK[role];
}

/** The stronger of an org-wide role and an optional per-project grant. */
export function effectiveRole(orgRole: OrgRole, projectRole?: ProjectRole | null): OrgRole {
  if (!projectRole) return orgRole;
  return roleRank(projectRole) > roleRank(orgRole) ? projectRole : orgRole;
}

export function isOrgRole(value: unknown): value is OrgRole {
  return typeof value === "string" && (ORG_ROLES as readonly string[]).includes(value);
}
