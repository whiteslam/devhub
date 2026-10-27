import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { safeNextPath } from "@/lib/routes";
import { signOut } from "@/server/actions/auth";
import { requireViewer } from "@/server/session";
import { MfaForm } from "./mfa-form";

export const metadata: Metadata = { title: "Two-factor verification" };

export default async function MfaPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const viewer = await requireViewer();
  const { next } = await searchParams;
  return (
    <AuthShell
      title="Two-factor verification"
      description={`Enter the 6-digit code from your authenticator app for ${viewer.email || "your account"}.`}
      footer={
        <form action={signOut}>
          <button type="submit" className="underline-offset-2 hover:text-muted hover:underline">
            Sign out instead
          </button>
        </form>
      }
    >
      <MfaForm next={safeNextPath(next)} />
    </AuthShell>
  );
}
