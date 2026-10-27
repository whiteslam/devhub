import { can } from "@devhub/auth";
import { buttonClasses, Card, EmptyState, PageHeader, Table, Td, Th } from "@devhub/ui";
import { Lock, ScrollText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { formatUtc } from "@/components/format";
import { listAuditLogs } from "@/server/queries";
import { requireWorkspace } from "@/server/session";

export const metadata: Metadata = { title: "Audit log" };

function summarize(changes: unknown): string {
  if (!changes || typeof changes !== "object") return "";
  const keys = Object.keys(changes as Record<string, unknown>).filter((k) => !["id", "organization_id", "created_at"].includes(k));
  return keys.slice(0, 4).join(", ") + (keys.length > 4 ? ` +${keys.length - 4}` : "");
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ cursor?: string }> }) {
  const workspace = await requireWorkspace();
  if (!can(workspace.auth, "audit:read")) {
    return (
      <Card>
        <EmptyState
          icon={<Lock className="size-5" />}
          title="Admins only"
          description="The audit log is visible to organization admins and owners."
        />
      </Card>
    );
  }
  const { cursor } = await searchParams;
  const { entries, nextCursor } = await listAuditLogs(workspace, cursor);

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Append-only record of configuration and privileged changes, written by the database itself. Times in UTC."
      />
      <Card>
        {entries.length ? (
          <Table>
            <thead>
              <tr>
                <Th>When</Th>
                <Th>Actor</Th>
                <Th>Action</Th>
                <Th className="hidden md:table-cell">Fields</Th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <Td className="whitespace-nowrap text-muted">{formatUtc(e.created_at)}</Td>
                  <Td>{e.actorEmail ?? <span className="text-faint">{e.actor_type}</span>}</Td>
                  <Td className="font-mono text-xs">{e.action}</Td>
                  <Td className="hidden max-w-xs truncate text-xs text-faint md:table-cell">{summarize(e.changes)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState icon={<ScrollText className="size-5" />} title="No audit entries" />
        )}
      </Card>
      <div className="mt-4 flex justify-end gap-2">
        {cursor ? (
          <Link href="/audit" className={buttonClasses("ghost", "sm")}>
            Newest
          </Link>
        ) : null}
        {nextCursor ? (
          <Link href={`/audit?cursor=${nextCursor}`} className={buttonClasses("secondary", "sm")}>
            Older entries
          </Link>
        ) : null}
      </div>
    </>
  );
}
