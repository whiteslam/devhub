import { effectiveRole, type OrgRole, type Permission, type ProjectRole, ROLE_PERMISSIONS, SENSITIVE_PERMISSIONS } from "./permissions";

/** Supabase Auth assurance level from the session JWT (`aal` claim). */
export type AssuranceLevel = "aal1" | "aal2";

export interface AuthContext {
  userId: string;
  organizationId: string;
  /** null when the user is not a member of the organization. */
  orgRole: OrgRole | null;
  projectRole?: ProjectRole | null;
  aal: AssuranceLevel;
  /** Organization setting: require AAL2 for sensitive permissions. */
  orgRequiresMfa: boolean;
}

export type AuthorizationDenial = "not_member" | "missing_permission" | "mfa_required";

export type AuthorizationResult = { allowed: true; role: OrgRole } | { allowed: false; reason: AuthorizationDenial; role: OrgRole | null };

export function authorize(ctx: AuthContext, permission: Permission): AuthorizationResult {
  if (!ctx.orgRole) return { allowed: false, reason: "not_member", role: null };
  const role = effectiveRole(ctx.orgRole, ctx.projectRole);
  if (!ROLE_PERMISSIONS[role].has(permission)) {
    return { allowed: false, reason: "missing_permission", role };
  }
  if (SENSITIVE_PERMISSIONS.has(permission) && ctx.orgRequiresMfa && ctx.aal !== "aal2") {
    return { allowed: false, reason: "mfa_required", role };
  }
  return { allowed: true, role };
}

export class AuthorizationError extends Error {
  readonly reason: AuthorizationDenial;
  readonly permission: Permission;

  constructor(permission: Permission, reason: AuthorizationDenial) {
    super(DENIAL_MESSAGES[reason]);
    this.name = "AuthorizationError";
    this.permission = permission;
    this.reason = reason;
  }
}

export const DENIAL_MESSAGES: Record<AuthorizationDenial, string> = {
  not_member: "You are not a member of this organization.",
  missing_permission: "Your role does not allow this action.",
  mfa_required: "This action requires two-factor authentication. Verify with your authenticator app first.",
};

export function assertAuthorized(ctx: AuthContext, permission: Permission): OrgRole {
  const result = authorize(ctx, permission);
  if (!result.allowed) throw new AuthorizationError(permission, result.reason);
  return result.role;
}

export function can(ctx: AuthContext, permission: Permission): boolean {
  return authorize(ctx, permission).allowed;
}
