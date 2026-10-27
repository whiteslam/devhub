import { can } from "@devhub/auth";
import { Alert, buttonClasses, Card, EmptyState, PageHeader } from "@devhub/ui";
import { FolderPlus, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ProjectTable } from "@/components/project-table";
import { listProjects } from "@/server/queries";
import { requireWorkspace } from "@/server/session";

export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ archived?: string }> }) {
  const workspace = await requireWorkspace();
  const [projects, { archived }] = await Promise.all([listProjects(workspace), searchParams]);
  const canCreate = can(workspace.auth, "project:create");

  return (
    <>
      <PageHeader
        title="Projects"
        description="Applications, APIs and sites registered in this organization."
        actions={
          canCreate ? (
            <Link href="/projects/new" className={buttonClasses("primary")}>
              <Plus className="size-4" aria-hidden="true" /> New project
            </Link>
          ) : null
        }
      />
      {archived ? (
        <div className="mb-4">
          <Alert tone="accent">Project archived. Its history is kept and it no longer appears in dashboards.</Alert>
        </div>
      ) : null}
      <Card>
        {projects.length ? (
          <ProjectTable projects={projects} />
        ) : (
          <EmptyState
            icon={<FolderPlus className="size-5" />}
            title="No projects yet"
            description="A project is one deployable application with its own environments, credentials and telemetry."
            action={
              canCreate ? (
                <Link href="/projects/new" className={buttonClasses("primary")}>
                  Register a project
                </Link>
              ) : undefined
            }
          />
        )}
      </Card>
    </>
  );
}
