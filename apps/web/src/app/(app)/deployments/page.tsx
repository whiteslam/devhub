import { Badge, Card, CardHeader, EmptyState, PageHeader, Table, Td, Th } from "@devhub/ui";
import { Rocket } from "lucide-react";
import type { Metadata } from "next";
import { formatUtc } from "@/components/format";
import { listProjects } from "@/server/queries";
import { requireWorkspace } from "@/server/session";

export const metadata: Metadata = { title: "Deployments" };

const STATUS_TONE = {
  ready: "ok",
  error: "bad",
  canceled: "neutral",
  rolled_back: "warn",
  queued: "neutral",
  building: "accent",
  deploying: "accent",
} as const;

export default async function DeploymentsPage() {
  const workspace = await requireWorkspace();
  const [projects, { data: deployments, error }] = await Promise.all([
    listProjects(workspace),
    workspace.supabase
      .from("deployments")
      .select("id, organization_id, project_id, environment_id, provider, status, url, created_at, finished_at")
      .eq("organization_id", workspace.organization.id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  if (error) throw new Error(error.message);

  return (
    <>
      <PageHeader
        title="Deployments"
        description="Deployment history reported by connected providers. Provider sync arrives in Phase 4; guarded deploy and rollback in Phase 5."
      />
      <Card>
        <CardHeader title="Recent deployments" />
        {deployments.length ? (
          <Table>
            <thead>
              <tr>
                <Th>Project</Th>
                <Th>Provider</Th>
                <Th>Status</Th>
                <Th className="hidden md:table-cell">Started</Th>
              </tr>
            </thead>
            <tbody>
              {deployments.map((d) => (
                <tr key={d.id}>
                  <Td className="font-medium">{projects.find((p) => p.id === d.project_id)?.name ?? "Archived project"}</Td>
                  <Td className="capitalize text-muted">{d.provider}</Td>
                  <Td>
                    <Badge tone={STATUS_TONE[d.status]}>{d.status.replace("_", " ")}</Badge>
                  </Td>
                  <Td className="hidden text-muted md:table-cell">{formatUtc(d.created_at)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState
            icon={<Rocket className="size-5" />}
            title="No deployments recorded"
            description="Connect Vercel, Coolify or GitHub in Integrations to import deployment events."
          />
        )}
      </Card>
    </>
  );
}
