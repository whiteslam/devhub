import { describe, expect, it } from "vitest";
import { type AuthContext, AuthorizationError, assertAuthorized, authorize, can } from "./authorize";
import { ORG_ROLES, PERMISSIONS, ROLE_PERMISSIONS, SENSITIVE_PERMISSIONS } from "./permissions";

const ctx = (overrides: Partial<AuthContext> = {}): AuthContext => ({
  userId: "u1",
  organizationId: "o1",
  orgRole: "viewer",
  projectRole: null,
  aal: "aal1",
  orgRequiresMfa: false,
  ...overrides,
});

describe("authorize", () => {
  it("denies non-members everything", () => {
    for (const permission of PERMISSIONS) {
      expect(authorize(ctx({ orgRole: null }), permission)).toEqual({
        allowed: false,
        reason: "not_member",
        role: null,
      });
    }
  });

  it("gives viewers read access only", () => {
    expect(can(ctx(), "project:read")).toBe(true);
    expect(can(ctx(), "project:create")).toBe(false);
    expect(can(ctx(), "deploy:execute")).toBe(false);
    expect(can(ctx(), "audit:read")).toBe(false);
  });

  it("keeps operational writes separate from configuration writes", () => {
    const operator = ctx({ orgRole: "operator" });
    expect(can(operator, "deploy:execute")).toBe(true);
    expect(can(operator, "project:create")).toBe(false);
    expect(can(operator, "credentials:manage")).toBe(false);

    const developer = ctx({ orgRole: "developer" });
    expect(can(developer, "issues:triage")).toBe(true);
    expect(can(developer, "deploy:execute")).toBe(false);
  });

  it("does not let owners bypass the MFA requirement", () => {
    const owner = ctx({ orgRole: "owner", orgRequiresMfa: true, aal: "aal1" });
    expect(authorize(owner, "deploy:rollback")).toMatchObject({ allowed: false, reason: "mfa_required" });
    expect(authorize(owner, "org:delete")).toMatchObject({ allowed: false, reason: "mfa_required" });
    // non-sensitive actions still work at aal1
    expect(can(owner, "project:create")).toBe(true);
    expect(can({ ...owner, aal: "aal2" }, "deploy:rollback")).toBe(true);
  });

  it("only owners hold billing and org deletion", () => {
    for (const role of ORG_ROLES) {
      expect(ROLE_PERMISSIONS[role].has("org:delete")).toBe(role === "owner");
      expect(ROLE_PERMISSIONS[role].has("billing:manage")).toBe(role === "owner");
    }
  });

  it("project grants elevate within a project but never above the grant", () => {
    const elevated = ctx({ orgRole: "viewer", projectRole: "operator" });
    expect(can(elevated, "deploy:execute")).toBe(true);
    expect(can(elevated, "project:archive")).toBe(false);
    // a weaker project grant never downgrades the org role
    expect(can(ctx({ orgRole: "admin", projectRole: "viewer" }), "project:update")).toBe(true);
  });

  it("every sensitive permission is a known permission", () => {
    for (const p of SENSITIVE_PERMISSIONS) expect(PERMISSIONS).toContain(p);
  });

  it("assertAuthorized throws a typed error", () => {
    expect(() => assertAuthorized(ctx(), "project:create")).toThrow(AuthorizationError);
    try {
      assertAuthorized(ctx(), "project:create");
    } catch (error) {
      expect((error as AuthorizationError).reason).toBe("missing_permission");
    }
    expect(assertAuthorized(ctx({ orgRole: "admin" }), "project:create")).toBe("admin");
  });
});
