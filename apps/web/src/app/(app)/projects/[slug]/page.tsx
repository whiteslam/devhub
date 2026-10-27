import { RELEASE_STRATEGY_LABELS } from "@devhub/contracts";
import { Badge, Card, CardBody, CardHeader, StatusDot, Table, Td, Th } from "@devhub/ui";
import { CircleCheck, CircleDashed } from "lucide-react";
import { notFound } from "next/navigation";
import { formatUtc, timeAgo } from "@/components/format";
import { getProject } from "@/server/queries";
import { requireWorkspace } from "@/server/session";

const SETUP_STEPS = [
  { title: "Register project and environments", phase: 1 },
  { title: "Choose framework & install the SDK", phase: 2 },
  { title: "Create browser and server credentials", phase: 2 },
  { title: "Configure environment variables", phase: 2 },
  { title: "Send a test event", phase: 2 },
  { title: "Verify the connection", phase: 2 },
];

export default async function ProjectOverviewPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const workspace = await requireWorkspace();
  const detail = await getProject(workspace, slug);
  if (!detail) notFound();
  const { project, environments, connections } = detail;

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="flex flex-col gap-5 lg:col-span-2">
        <Card aria-labelledby="health-h">
          <CardHeader id="health-h" title="Health" />
          <CardBody>
            <div className="flex items-start gap-3">
              <StatusDot tone={project.tone} className="mt-1.5" />
              <div>
                <p className="text-sm font-medium">{project.health.label}</p>
                <p className="mt-0.5 text-[13px] text-muted">{project.health.detail}</p>
                <p className="mt-2 text-xs text-faint">
                  Last telemetry:{" "}
                  {project.last_event_at ? `${timeAgo(project.last_event_at)} (${formatUtc(project.last_event_at)})` : "never received"}
                </p>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card aria-labelledby="env-h">
          <CardHeader id="env-h" title="Environments" description="Each environment is monitored and credentialed separately." />
          <Table>
            <thead>
              <tr>
                <Th>Environment</Th>
                <Th>Kind</Th>
                <Th className="hidden sm:table-cell">URL</Th>
                <Th>Telemetry</Th>
              </tr>
            </thead>
            <tbody>
              {environments.map((env) => {
                const envConnections = connections.filter((c) => c.environment_id === env.id);
                const last =
                  envConnections
                    .map((c) => c.last_event_at)
                    .filter(Boolean)
                    .sort()
                    .at(-1) ?? null;
                return (
                  <tr key={env.id}>
                    <Td>
                      <span className="font-medium">{env.name}</span>
                      <div className="font-mono text-[11px] text-faint">{env.slug}</div>
                    </Td>
                    <Td>
                      <Badge tone={env.kind === "production" ? "accent" : "neutral"}>{env.kind}</Badge>
                    </Td>
                    <Td className="hidden max-w-56 truncate text-muted sm:table-cell">
                      {env.base_url ?? <span className="text-faint">—</span>}
                    </Td>
                    <Td className="text-muted">{last ? timeAgo(last) : <span className="text-faint">No data</span>}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
      </div>

      <div className="flex flex-col gap-5">
        <Card aria-labelledby="setup-h">
          <CardHeader id="setup-h" title="Connection setup" description="The project is marked connected only after verification passes." />
          <CardBody>
            <ol className="flex flex-col gap-3">
              {SETUP_STEPS.map((step, i) => {
                const done = i === 0;
                return (
                  <li key={step.title} className="flex items-start gap-2.5 text-[13px]">
                    {done ? (
                      <CircleCheck className="mt-0.5 size-4 shrink-0 text-ok" aria-label="Done" />
                    ) : (
                      <CircleDashed className="mt-0.5 size-4 shrink-0 text-faint" aria-label="Not started" />
                    )}
                    <span className={done ? "text-fg" : "text-muted"}>
                      {step.title}
                      {!done ? <span className="ml-1.5 text-[11px] text-faint">· Phase {step.phase}</span> : null}
                    </span>
                  </li>
                );
              })}
            </ol>
          </CardBody>
        </Card>

        <Card aria-labelledby="details-h">
          <CardHeader id="details-h" title="Details" />
          <CardBody>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[13px]">
              <dt className="text-faint">Releases</dt>
              <dd>{RELEASE_STRATEGY_LABELS[project.release_strategy]}</dd>
              <dt className="text-faint">Repository</dt>
              <dd className="truncate">
                {project.repository_url ? (
                  <a href={project.repository_url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                    {project.repository_url.replace(/^https?:\/\//, "")}
                  </a>
                ) : (
                  <span className="text-faint">Not linked</span>
                )}
              </dd>
              <dt className="text-faint">Registered</dt>
              <dd>{formatUtc(project.created_at)}</dd>
            </dl>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
