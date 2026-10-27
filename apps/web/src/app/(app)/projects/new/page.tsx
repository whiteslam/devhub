import { can } from "@devhub/auth";
import { Card, EmptyState, PageHeader } from "@devhub/ui";
import { Lock } from "lucide-react";
import type { Metadata } from "next";
import { requireWorkspace } from "@/server/session";
import { NewProjectForm } from "./new-project-form";

export const metadata: Metadata = { title: "Register project" };

export default async function NewProjectPage() {
  const workspace = await requireWorkspace();
  if (!can(workspace.auth, "project:create")) {
    return (
      <Card>
        <EmptyState
          icon={<Lock className="size-5" />}
          title="You cannot register projects"
          description="Registering projects requires the admin or owner role in this organization."
        />
      </Card>
    );
  }
  return (
    <div className="max-w-3xl">
      <PageHeader
        eyebrow="Projects"
        title="Register a project"
        description="Registration creates the project and its environments. You will connect telemetry in the next step — it stays “Not connected” until verification passes."
      />
      <NewProjectForm orgSlug={workspace.organization.slug} />
    </div>
  );
}
