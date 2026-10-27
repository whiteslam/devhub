/**
 * Typed view of the public schema for supabase-js.
 *
 * Hand-maintained for the tables the dashboard reads in Phase 1. When the
 * Supabase CLI is available, `supabase gen types typescript --local` can
 * replace this file; keep the exported row aliases stable.
 */
import type { OrgRole, ProjectRole } from "@devhub/auth";
import type { AppType, ConnectionStatus, EnvironmentKind, Framework, HostingProvider, ReleaseStrategy } from "@devhub/contracts";

type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type UserRow = {
  id: string;
  email: string;
  display_name: string | null;
  created_at: string;
  updated_at: string;
};

export type OrganizationRow = {
  id: string;
  name: string;
  slug: string;
  require_mfa: boolean;
  telemetry_retention_days: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type MembershipRow = {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrgRole;
  created_at: string;
  updated_at: string;
};

export type ProjectRow = {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  framework: Framework;
  app_type: AppType;
  base_url: string | null;
  repository_url: string | null;
  hosting_provider: HostingProvider;
  release_strategy: ReleaseStrategy;
  monitoring_config: Json;
  connection_status: ConnectionStatus;
  last_event_at: string | null;
  created_by: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type EnvironmentRow = {
  id: string;
  organization_id: string;
  project_id: string;
  name: string;
  slug: string;
  kind: EnvironmentKind;
  base_url: string | null;
  created_at: string;
  updated_at: string;
};

export type ProjectMemberRow = {
  id: string;
  organization_id: string;
  project_id: string;
  user_id: string;
  role: ProjectRole;
  created_at: string;
};

export type ProjectConnectionRow = {
  id: string;
  organization_id: string;
  project_id: string;
  environment_id: string;
  kind: "browser_sdk" | "server_sdk" | "nextjs_sdk" | "http_check" | "webhook";
  status: "pending" | "verifying" | "verified" | "failing";
  required: boolean;
  checks: Json;
  last_event_at: string | null;
  last_verified_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

export type AuditLogRow = {
  id: string;
  organization_id: string;
  project_id: string | null;
  actor_id: string | null;
  actor_type: "user" | "system" | "api_credential";
  action: string;
  target_table: string | null;
  target_id: string | null;
  changes: Json;
  request_id: string | null;
  created_at: string;
};

export type IncidentRow = {
  id: string;
  organization_id: string;
  project_id: string;
  environment_id: string | null;
  title: string;
  severity: "critical" | "major" | "minor";
  status: "open" | "acknowledged" | "resolved";
  opened_at: string;
  resolved_at: string | null;
};

export type IssueRow = {
  id: string;
  organization_id: string;
  project_id: string;
  title: string;
  level: "fatal" | "error" | "warning" | "info";
  status: "unresolved" | "resolved" | "ignored" | "regressed";
  occurrence_count: number;
  first_seen_at: string;
  last_seen_at: string;
};

export type DeploymentRow = {
  id: string;
  organization_id: string;
  project_id: string;
  environment_id: string;
  provider: string;
  status: "queued" | "building" | "deploying" | "ready" | "error" | "canceled" | "rolled_back";
  url: string | null;
  created_at: string;
  finished_at: string | null;
};

/** Client-visible columns only; credentials_ciphertext is not granted to clients. */
export type IntegrationRow = {
  id: string;
  organization_id: string;
  project_id: string | null;
  provider: "github" | "vercel" | "coolify" | "docker" | "supabase" | "http_webhook";
  name: string;
  status: "pending" | "active" | "error" | "disabled";
  capabilities: string[];
  last_synced_at: string | null;
  last_error: string | null;
  created_at: string;
};

export type Database = {
  __InternalSupabase: { PostgrestVersion: "12" };
  public: {
    Tables: {
      users: Table<UserRow, never, Pick<UserRow, "display_name">>;
      organizations: Table<OrganizationRow, never, Pick<OrganizationRow, "name">>;
      memberships: Table<MembershipRow, never, never>;
      projects: Table<
        ProjectRow,
        never,
        Partial<
          Pick<
            ProjectRow,
            | "name"
            | "framework"
            | "app_type"
            | "base_url"
            | "repository_url"
            | "hosting_provider"
            | "release_strategy"
            | "monitoring_config"
          >
        >
      >;
      environments: Table<EnvironmentRow, never, Partial<Pick<EnvironmentRow, "name" | "base_url">>>;
      project_members: Table<ProjectMemberRow, never, never>;
      project_connections: Table<ProjectConnectionRow, never, never>;
      audit_logs: Table<AuditLogRow, never, never>;
      incidents: Table<IncidentRow, never, never>;
      issues: Table<IssueRow, never, Pick<IssueRow, "status">>;
      deployments: Table<DeploymentRow, never, never>;
      integrations: Table<IntegrationRow, never, never>;
    };
    Views: { [_ in never]: never };
    Functions: {
      create_organization: { Args: { p_name: string; p_slug: string }; Returns: string };
      create_project: { Args: { p_organization_id: string; p_project: Json }; Returns: string };
      archive_project: { Args: { p_project_id: string; p_confirm_slug: string }; Returns: undefined };
      update_organization_security: {
        Args: { p_org: string; p_require_mfa: boolean; p_retention_days: number };
        Returns: undefined;
      };
    };
    Enums: { org_role: OrgRole; project_role: ProjectRole };
    CompositeTypes: { [_ in never]: never };
  };
};
