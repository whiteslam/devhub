import "server-only";
import { deriveHealth, type HealthSummary, monitoringConfigSchema } from "@devhub/contracts";
import type { AuditLogRow, EnvironmentRow, ProjectConnectionRow, ProjectRow } from "@devhub/database";
import type { Tone } from "@devhub/ui";
import { cache } from "react";
import type { Workspace } from "./session";

/** Columns needed for lists; never select telemetry payloads on overview pages. */
const PROJECT_LIST_COLUMNS =
  "id, organization_id, name, slug, framework, app_type, base_url, repository_url, hosting_provider, release_strategy, monitoring_config, connection_status, last_event_at, created_by, archived_at, created_at, updated_at";

export interface ProjectWithHealth extends ProjectRow {
  health: HealthSummary;
  tone: Tone;
  openIncidents: number;
}

export const HEALTH_TONE: Record<HealthSummary["state"], Tone> = {
  healthy: "ok",
  degraded: "warn",
  stale: "warn",
  unknown: "unknown",
};

function withHealth(project: ProjectRow, openIncidents: number, now: Date): ProjectWithHealth {
  const monitoring = monitoringConfigSchema.safeParse(project.monitoring_config);
  const health = deriveHealth(
    {
      connectionStatus: project.connection_status,
      lastEventAt: project.last_event_at,
      staleAfterMinutes: monitoring.success ? monitoring.data.staleAfterMinutes : 60,
      openIncidents,
    },
    now,
  );
  return { ...project, health, tone: HEALTH_TONE[health.state], openIncidents };
}

export const listProjects = cache(async (workspace: Workspace): Promise<ProjectWithHealth[]> => {
  const [projects, incidents] = await Promise.all([
    workspace.supabase
      .from("projects")
      .select(PROJECT_LIST_COLUMNS)
      .eq("organization_id", workspace.organization.id)
      .is("archived_at", null)
      .order("name")
      .limit(200),
    workspace.supabase
      .from("incidents")
      .select("project_id")
      .eq("organization_id", workspace.organization.id)
      .neq("status", "resolved")
      .limit(1000),
  ]);
  if (projects.error) throw new Error(`Failed to load projects: ${projects.error.message}`);
  if (incidents.error) throw new Error(`Failed to load incidents: ${incidents.error.message}`);
  const open = new Map<string, number>();
  for (const i of incidents.data) open.set(i.project_id, (open.get(i.project_id) ?? 0) + 1);
  const now = new Date();
  return projects.data.map((p) => withHealth(p as ProjectRow, open.get(p.id) ?? 0, now));
});

export interface ProjectDetail {
  project: ProjectWithHealth;
  environments: EnvironmentRow[];
  connections: ProjectConnectionRow[];
}

export const getProject = cache(async (workspace: Workspace, slug: string): Promise<ProjectDetail | null> => {
  const { data: project, error } = await workspace.supabase
    .from("projects")
    .select(PROJECT_LIST_COLUMNS)
    .eq("organization_id", workspace.organization.id)
    .eq("slug", slug)
    .is("archived_at", null)
    .maybeSingle();
  if (error) throw new Error(`Failed to load project: ${error.message}`);
  if (!project) return null;

  const [environments, connections, incidents] = await Promise.all([
    workspace.supabase.from("environments").select("*").eq("project_id", project.id).order("created_at"),
    workspace.supabase.from("project_connections").select("*").eq("project_id", project.id),
    workspace.supabase
      .from("incidents")
      .select("id", { count: "exact", head: true })
      .eq("project_id", project.id)
      .neq("status", "resolved"),
  ]);
  if (environments.error) throw new Error(`Failed to load environments: ${environments.error.message}`);
  if (connections.error) throw new Error(`Failed to load connections: ${connections.error.message}`);
  return {
    project: withHealth(project as ProjectRow, incidents.count ?? 0, new Date()),
    environments: environments.data,
    connections: connections.data,
  };
});

export interface AuditPage {
  entries: (AuditLogRow & { actorEmail: string | null })[];
  nextCursor: string | null;
}

/** Keyset pagination on (created_at, id) — stable under concurrent inserts. */
export async function listAuditLogs(workspace: Workspace, cursor: string | undefined, limit = 50): Promise<AuditPage> {
  let query = workspace.supabase
    .from("audit_logs")
    .select("*")
    .eq("organization_id", workspace.organization.id)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1);
  const decoded = decodeCursor(cursor);
  if (decoded) {
    query = query.or(`created_at.lt.${decoded.createdAt},and(created_at.eq.${decoded.createdAt},id.lt.${decoded.id})`);
  }
  const { data, error } = await query;
  if (error) throw new Error(`Failed to load audit log: ${error.message}`);
  const page = data.slice(0, limit);
  const actorIds = [...new Set(page.flatMap((e) => (e.actor_id ? [e.actor_id] : [])))];
  const users = actorIds.length ? ((await workspace.supabase.from("users").select("id, email").in("id", actorIds)).data ?? []) : [];
  const last = page.at(-1);
  return {
    entries: page.map((e) => ({ ...e, actorEmail: users.find((u) => u.id === e.actor_id)?.email ?? null })),
    nextCursor: data.length > limit && last ? encodeCursor(last.created_at, last.id) : null,
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function encodeCursor(createdAt: string, id: string): string {
  return Buffer.from(JSON.stringify([createdAt, id])).toString("base64url");
}

/** Rejects anything that is not exactly [ISO timestamp, uuid] so it cannot inject into the filter. */
export function decodeCursor(cursor: string | undefined): { createdAt: string; id: string } | null {
  if (!cursor || cursor.length > 200) return null;
  try {
    const value: unknown = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (!Array.isArray(value) || value.length !== 2) return null;
    const [createdAt, id] = value;
    if (typeof createdAt !== "string" || typeof id !== "string" || !UUID.test(id)) return null;
    const date = new Date(createdAt);
    if (Number.isNaN(date.getTime())) return null;
    return { createdAt: date.toISOString(), id };
  } catch {
    return null;
  }
}

export interface MemberRow {
  userId: string;
  email: string;
  displayName: string | null;
  role: string;
  joinedAt: string;
}

export async function listMembers(workspace: Workspace): Promise<MemberRow[]> {
  const { data: memberships, error } = await workspace.supabase
    .from("memberships")
    .select("user_id, role, created_at")
    .eq("organization_id", workspace.organization.id)
    .order("created_at");
  if (error) throw new Error(`Failed to load members: ${error.message}`);
  const { data: users } = await workspace.supabase
    .from("users")
    .select("id, email, display_name")
    .in(
      "id",
      memberships.map((m) => m.user_id),
    );
  return memberships.map((m) => {
    const user = users?.find((u) => u.id === m.user_id);
    return {
      userId: m.user_id,
      email: user?.email ?? "unknown",
      displayName: user?.display_name ?? null,
      role: m.role,
      joinedAt: m.created_at,
    };
  });
}
