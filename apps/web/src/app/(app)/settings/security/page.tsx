import { Alert, Badge, Button, Card, CardBody, CardHeader, PageHeader } from "@devhub/ui";
import type { Metadata } from "next";
import { formatUtc } from "@/components/format";
import { MfaEnrollment } from "@/components/mfa-enrollment";
import { removeTotpFactor, signOutEverywhere } from "@/server/actions/auth";
import { requireWorkspace } from "@/server/session";
import { SettingsNav } from "../settings-nav";

export const metadata: Metadata = { title: "Security" };

export default async function SecurityPage({ searchParams }: { searchParams: Promise<{ enrolled?: string }> }) {
  const workspace = await requireWorkspace();
  const { enrolled } = await searchParams;
  const { data: factors } = await workspace.supabase.auth.mfa.listFactors();
  const verified = factors?.totp ?? [];

  return (
    <div className="max-w-3xl">
      <PageHeader title="Settings" />
      <SettingsNav active="security" />
      <div className="flex flex-col gap-5">
        {enrolled ? <Alert tone="accent">Authenticator enabled. Future sign-ins will ask for a code.</Alert> : null}
        <Card>
          <CardHeader
            title="Two-factor authentication"
            description="Time-based one-time codes (TOTP) via Supabase Auth."
            actions={<Badge tone={verified.length ? "ok" : "warn"}>{verified.length ? "Enabled" : "Not enabled"}</Badge>}
          />
          <CardBody>
            {verified.length ? (
              <ul className="flex flex-col gap-3">
                {verified.map((f) => (
                  <li key={f.id} className="flex items-center justify-between gap-3 text-[13px]">
                    <span>
                      {f.friendly_name ?? "Authenticator app"} <span className="text-faint">· added {formatUtc(f.created_at)}</span>
                    </span>
                    <form action={removeTotpFactor}>
                      <input type="hidden" name="factorId" value={f.id} />
                      <Button type="submit" variant="danger" size="sm">
                        Remove
                      </Button>
                    </form>
                  </li>
                ))}
              </ul>
            ) : (
              <MfaEnrollment />
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader
            title="Sessions"
            description={`This session: ${workspace.viewer.aal === "aal2" ? "verified with two factors" : "single factor"}.`}
          />
          <CardBody>
            <form action={signOutEverywhere} className="flex flex-col items-start gap-3">
              <p className="text-[13px] text-muted">Revoke every session for your account on all devices, including this one.</p>
              <Button type="submit" variant="danger">
                Sign out everywhere
              </Button>
            </form>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
