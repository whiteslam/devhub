import { Badge, Card, PageHeader } from "@devhub/ui";
import type { Metadata } from "next";
import { requireWorkspace } from "@/server/session";

export const metadata: Metadata = { title: "Integrations" };

/** Planned adapters and what each provider can actually support. */
const PROVIDERS = [
  { id: "github", name: "GitHub", capabilities: ["Repository metadata", "CI status", "Signed webhooks"] },
  { id: "vercel", name: "Vercel", capabilities: ["Deployment events", "Deployment metadata", "Promote / rollback (API)"] },
  { id: "coolify", name: "Coolify", capabilities: ["Application status", "Deploy & restart (API)"] },
  { id: "docker", name: "Docker host", capabilities: ["Container health via restricted agent"] },
  { id: "supabase", name: "Supabase", capabilities: ["Project health", "Usage metrics where exposed"] },
  { id: "http_webhook", name: "Generic webhook", capabilities: ["HMAC-signed inbound events"] },
] as const;

export default async function IntegrationsPage() {
  const workspace = await requireWorkspace();
  const { data, error } = await workspace.supabase
    .from("integrations")
    .select("provider, status")
    .eq("organization_id", workspace.organization.id);
  if (error) throw new Error(error.message);
  const connected = new Map<string, string>(data.map((i) => [i.provider, i.status]));

  return (
    <>
      <PageHeader
        title="Integrations"
        description="Provider adapters declare their capabilities explicitly — not every provider exposes the same data or actions. Adapters ship in Phase 4."
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {PROVIDERS.map((p) => (
          <Card key={p.id} className="flex flex-col p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">{p.name}</h2>
              <Badge tone={connected.get(p.id) === "active" ? "ok" : "unknown"}>{connected.get(p.id) ?? "Not connected"}</Badge>
            </div>
            <ul className="mt-3 flex-1 space-y-1 text-[13px] text-muted">
              {p.capabilities.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-faint">Available in Phase 4</p>
          </Card>
        ))}
      </div>
    </>
  );
}
