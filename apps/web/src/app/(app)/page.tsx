import { can } from "@devhub/auth";
import { buttonClasses, Card, CardHeader, EmptyState, PageHeader, Stat } from "@devhub/ui";
import { FolderPlus, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ProjectTable } from "@/components/project-table";
import { listProjects } from "@/server/queries";
import { requireWorkspace } from "@/server/session";

export const metadata: Metadata = { title: "Overview" };

export default async function OverviewPage() {
  const workspace = await requireWorkspace();
  const projects = await listProjects(workspace);
  const counts = {
    connected: projects.filter((p) => p.connection_status === "connected").length,
    unknown: projects.filter((p) => p.health.state === "unknown" || p.health.state === "stale").length,
    incidents: projects.reduce((n, p) => n + p.openIncidents, 0),
  };
  const canCreate = can(workspace.auth, "project:create");

  return (
    <>
      <PageHeader
        eyebrow={workspace.organization.name}
        title="Portfolio overview"
        description="Every application you operate, with health derived only from verified telemetry."
        actions={
          canCreate ? (
            <Link href="/projects/new" className={buttonClasses("primary")}>
              <Plus className="size-4" aria-hidden="true" /> Register project
            </Link>
          ) : null
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Projects" value={projects.length} />
        <Stat label="Fully connected" value={counts.connected} hint={`of ${projects.length}`} />
        <Stat label="No data or stale" value={counts.unknown} hint="Health cannot be confirmed" />
        <Stat label="Open incidents" value={counts.incidents} />
      </div>

      <Card aria-labelledby="projects-heading" className="relative">
        <CardHeader
          id="projects-heading"
          title="Projects"
          description="Sorted by name. Health is “No data” until a project's SDK or checks are verified."
        />
        {projects.length ? (
          <ProjectTable projects={projects} />
        ) : (
          <EmptyState
            icon={<FolderPlus className="size-5" />}
            title="No projects registered"
            description="Register your first application to generate credentials and connect its telemetry. DevHub shows no sample data."
            action={
              canCreate ? (
                <Link href="/projects/new" className={buttonClasses("primary")}>
                  Register a project
                </Link>
              ) : (
                <p className="text-xs text-faint">Ask an admin to register projects.</p>
              )
            }
          />
        )}
      </Card>
    </>
  );
}
