import { can } from "@devhub/auth";
import type { ReactNode } from "react";
import { Sidebar } from "@/components/sidebar";
import { listProjects } from "@/server/queries";
import { requireWorkspace } from "@/server/session";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const workspace = await requireWorkspace();
  const projects = await listProjects(workspace);

  return (
    <div className="lg:flex">
      <Sidebar
        organizations={workspace.memberships.map((m) => ({ id: m.organization.id, name: m.organization.name, role: m.role }))}
        activeOrganizationId={workspace.organization.id}
        permissions={{
          "audit:read": can(workspace.auth, "audit:read"),
          "billing:read": can(workspace.auth, "billing:read"),
          "project:create": can(workspace.auth, "project:create"),
        }}
        projects={projects.map((p) => ({ slug: p.slug, name: p.name, tone: p.tone, label: p.health.label }))}
        user={{ email: workspace.viewer.email, aal: workspace.viewer.aal, role: workspace.role }}
      />
      <main id="main" className="shell-glow min-w-0 flex-1">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">{children}</div>
      </main>
    </div>
  );
}
