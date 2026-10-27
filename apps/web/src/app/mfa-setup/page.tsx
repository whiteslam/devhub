import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { MfaEnrollment } from "@/components/mfa-enrollment";
import { signOut } from "@/server/actions/auth";
import { getMemberships, requireStepUp } from "@/server/session";

export const metadata: Metadata = { title: "Two-factor required" };

/** Shown when the active organization requires MFA and the user has not enrolled yet. */
export default async function MfaSetupPage() {
  const viewer = await requireStepUp();
  if (viewer.aal === "aal2") redirect("/");
  const requiring = (await getMemberships()).filter((m) => m.organization.require_mfa).map((m) => m.organization.name);
  if (!requiring.length) redirect("/");

  return (
    <AuthShell
      title="Set up two-factor authentication"
      description={`${requiring.join(", ")} requires an authenticator app for every member. Until you enroll, its data stays locked — the database enforces this, not just the dashboard.`}
      footer={
        <form action={signOut}>
          <button type="submit" className="underline-offset-2 hover:text-muted hover:underline">
            Sign out
          </button>
        </form>
      }
    >
      <MfaEnrollment />
    </AuthShell>
  );
}
