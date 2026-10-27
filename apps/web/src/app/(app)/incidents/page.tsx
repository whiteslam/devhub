import { Badge, Card, CardHeader, EmptyState, PageHeader, Table, Td, Th } from "@devhub/ui";
import { Siren } from "lucide-react";
import type { Metadata } from "next";
import { formatUtc } from "@/components/format";
import { listProjects } from "@/server/queries";
import { requireWorkspace } from "@/server/session";

export const metadata: Metadata = { title: "Incidents & alerts" };

const SEVERITY_TONE = { critical: "bad", major: "warn", minor: "neutral" } as const;

export default async function IncidentsPage() {
  const workspace = await requireWorkspace();
  const [projects, { data: incidents, error }] = await Promise.all([
    listProjects(workspace),
    workspace.supabase
      .from("incidents")
      .select("id, organization_id, project_id, environment_id, title, severity, status, opened_at, resolved_at")
      .eq("organization_id", workspace.organization.id)
      .order("opened_at", { ascending: false })
      .limit(50),
  ]);
  if (error) throw new Error(error.message);
  const unmonitored = projects.filter((p) => p.health.state === "unknown" || p.health.state === "stale").length;

  return (
    <>
      <PageHeader
        title="Incidents & alerts"
        description="Incidents opened by alert rules. Detection and notification routing ship in Phase 3."
      />
      {unmonitored ? (
        <p className="mb-4 rounded-lg border border-warn/30 bg-warn/10 px-3.5 py-2.5 text-[13px] text-warn">
          {unmonitored} project{unmonitored === 1 ? " has" : "s have"} no current telemetry. An empty incident list does not mean{" "}
          {unmonitored === 1 ? "it is" : "they are"} healthy.
        </p>
      ) : null}
      <Card>
        <CardHeader title="Recent incidents" description="Latest 50, newest first." />
        {incidents.length ? (
          <Table>
            <thead>
              <tr>
                <Th>Incident</Th>
                <Th>Project</Th>
                <Th>Severity</Th>
                <Th>Status</Th>
                <Th className="hidden md:table-cell">Opened</Th>
              </tr>
            </thead>
            <tbody>
              {incidents.map((i) => (
                <tr key={i.id}>
                  <Td className="font-medium">{i.title}</Td>
                  <Td className="text-muted">{projects.find((p) => p.id === i.project_id)?.name ?? "Archived project"}</Td>
                  <Td>
                    <Badge tone={SEVERITY_TONE[i.severity]}>{i.severity}</Badge>
                  </Td>
                  <Td>
                    <Badge tone={i.status === "resolved" ? "ok" : "bad"}>{i.status}</Badge>
                  </Td>
                  <Td className="hidden text-muted md:table-cell">{formatUtc(i.opened_at)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState
            icon={<Siren className="size-5" />}
            title="No incidents recorded"
            description="Incidents appear here once alert rules evaluate verified telemetry."
          />
        )}
      </Card>
    </>
  );
}
