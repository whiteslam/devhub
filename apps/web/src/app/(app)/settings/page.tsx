import { can } from "@devhub/auth";
import { PageHeader } from "@devhub/ui";
import type { Metadata } from "next";
import { requireWorkspace } from "@/server/session";
import { OrganizationSecurityForm, RenameOrganizationForm } from "./organization-forms";
import { SettingsNav } from "./settings-nav";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const workspace = await requireWorkspace();
  return (
    <div className="max-w-3xl">
      <PageHeader title="Settings" />
      <SettingsNav active="organization" />
      <div className="flex flex-col gap-5">
        <RenameOrganizationForm organization={workspace.organization} canEdit={can(workspace.auth, "org:update")} />
        <OrganizationSecurityForm organization={workspace.organization} isOwner={workspace.role === "owner"} />
      </div>
    </div>
  );
}
