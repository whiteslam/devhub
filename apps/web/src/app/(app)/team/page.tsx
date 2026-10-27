import { isOrgRole, ROLE_DESCRIPTIONS, ROLE_LABELS } from "@devhub/auth";
import { Badge, Card, CardHeader, PageHeader, Table, Td, Th } from "@devhub/ui";
import type { Metadata } from "next";
import { formatUtc } from "@/components/format";
import { listMembers } from "@/server/queries";
import { requireWorkspace } from "@/server/session";

export const metadata: Metadata = { title: "Team & access" };

export default async function TeamPage() {
  const workspace = await requireWorkspace();
  const members = await listMembers(workspace);
  return (
    <>
      <PageHeader
        title="Team & access"
        description="Members of this organization and what their roles allow. Invitations and role changes arrive with Phase 2."
      />
      <Card className="mb-5">
        <CardHeader title={`Members (${members.length})`} />
        <Table>
          <thead>
            <tr>
              <Th>Member</Th>
              <Th>Role</Th>
              <Th className="hidden sm:table-cell">Joined</Th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.userId}>
                <Td>
                  <span className="font-medium">{m.displayName ?? m.email}</span>
                  {m.userId === workspace.viewer.userId ? <span className="ml-2 text-xs text-faint">(you)</span> : null}
                  {m.displayName ? <div className="text-xs text-faint">{m.email}</div> : null}
                </Td>
                <Td>
                  <Badge tone={m.role === "owner" ? "accent" : "neutral"}>{isOrgRole(m.role) ? ROLE_LABELS[m.role] : m.role}</Badge>
                </Td>
                <Td className="hidden text-muted sm:table-cell">{formatUtc(m.joinedAt)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
      <Card>
        <CardHeader
          title="Roles"
          description="Read access is separate from configuration and operational writes. No role bypasses checks — owners included."
        />
        <dl className="divide-y divide-line/60">
          {Object.entries(ROLE_DESCRIPTIONS).map(([role, description]) => (
            <div key={role} className="grid gap-1 px-5 py-3 sm:grid-cols-[140px_1fr]">
              <dt className="text-[13px] font-medium">{isOrgRole(role) ? ROLE_LABELS[role] : role}</dt>
              <dd className="text-[13px] text-muted">{description}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </>
  );
}
