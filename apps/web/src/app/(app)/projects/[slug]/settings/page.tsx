import { authorize } from "@devhub/auth";
import { notFound } from "next/navigation";
import { getProject } from "@/server/queries";
import { projectRoleFor, requireWorkspace } from "@/server/session";
import { ArchiveProjectForm, ProjectSettingsForm } from "./project-settings-forms";

export default async function ProjectSettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const workspace = await requireWorkspace();
  const detail = await getProject(workspace, slug);
  if (!detail) notFound();
  const ctx = { ...workspace.auth, projectRole: await projectRoleFor(workspace, detail.project.id) };
  const canEdit = authorize(ctx, "project:update").allowed;
  const archive = authorize(ctx, "project:archive");

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <ProjectSettingsForm project={detail.project} canEdit={canEdit} />
      {archive.allowed || (!archive.allowed && archive.reason === "mfa_required") ? (
        <ArchiveProjectForm project={detail.project} mfaBlocked={!archive.allowed} />
      ) : null}
    </div>
  );
}
