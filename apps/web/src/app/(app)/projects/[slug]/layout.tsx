import { FRAMEWORK_LABELS, HOSTING_PROVIDER_LABELS } from "@devhub/contracts";
import { Badge, StatusDot } from "@devhub/ui";
import { ExternalLink } from "lucide-react";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ProjectTabs } from "@/components/project-tabs";
import { getProject } from "@/server/queries";
import { requireWorkspace } from "@/server/session";

export default async function ProjectLayout({ children, params }: { children: ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const workspace = await requireWorkspace();
  const detail = await getProject(workspace, slug);
  if (!detail) notFound();
  const { project } = detail;

  return (
    <>
      <div className="flex flex-col gap-3 pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="mb-1.5 font-mono text-xs text-faint">
            {workspace.organization.slug}/{project.slug}
          </p>
          <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">{project.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-muted">
            <span className="inline-flex items-center gap-1.5" title={project.health.detail}>
              <StatusDot tone={project.tone} /> {project.health.label}
            </span>
            <span aria-hidden="true" className="text-faint">
              ·
            </span>
            <span>{FRAMEWORK_LABELS[project.framework]}</span>
            <span aria-hidden="true" className="text-faint">
              ·
            </span>
            <span>{HOSTING_PROVIDER_LABELS[project.hosting_provider]}</span>
            {project.base_url ? (
              <a
                href={project.base_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-accent hover:underline"
              >
                {new URL(project.base_url).host} <ExternalLink className="size-3" aria-hidden="true" />
              </a>
            ) : null}
          </div>
        </div>
        <Badge tone={project.connection_status === "connected" ? "ok" : "unknown"}>
          {project.connection_status === "connected" ? "Connected" : "Setup incomplete"}
        </Badge>
      </div>
      <ProjectTabs slug={project.slug} />
      {children}
    </>
  );
}
