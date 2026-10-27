import { FRAMEWORK_LABELS, HOSTING_PROVIDER_LABELS } from "@devhub/contracts";
import { Badge, StatusDot, Table, Td, Th } from "@devhub/ui";
import Link from "next/link";
import type { ProjectWithHealth } from "@/server/queries";
import { timeAgo } from "./format";

const CONNECTION_LABEL = {
  pending: "Not connected",
  partial: "Partially connected",
  connected: "Connected",
  degraded: "Degraded",
} as const;

export function ProjectTable({ projects }: { projects: ProjectWithHealth[] }) {
  return (
    <Table>
      <thead>
        <tr>
          <Th>Project</Th>
          <Th>Health</Th>
          <Th className="hidden md:table-cell">Connection</Th>
          <Th className="hidden lg:table-cell">Stack</Th>
          <Th className="hidden sm:table-cell">Last telemetry</Th>
          <Th className="text-right">Incidents</Th>
        </tr>
      </thead>
      <tbody>
        {projects.map((p) => (
          <tr key={p.id} className="group hover:bg-raised/40">
            <Td>
              <Link href={`/projects/${p.slug}`} className="font-medium text-fg group-hover:text-accent focus-visible:underline">
                {p.name}
              </Link>
              <div className="font-mono text-[11px] text-faint">{p.slug}</div>
            </Td>
            <Td>
              <span className="inline-flex items-center gap-2" title={p.health.detail}>
                <StatusDot tone={p.tone} />
                {p.health.label}
              </span>
            </Td>
            <Td className="hidden md:table-cell">
              <Badge tone={p.connection_status === "connected" ? "ok" : p.connection_status === "pending" ? "unknown" : "warn"}>
                {CONNECTION_LABEL[p.connection_status]}
              </Badge>
            </Td>
            <Td className="hidden text-muted lg:table-cell">
              {FRAMEWORK_LABELS[p.framework]} · {HOSTING_PROVIDER_LABELS[p.hosting_provider]}
            </Td>
            <Td className="hidden text-muted sm:table-cell">{timeAgo(p.last_event_at)}</Td>
            <Td className="text-right tabular-nums">{p.openIncidents || <span className="text-faint">0</span>}</Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
