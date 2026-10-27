import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { allowSignup } from "@/env";
import { safeNextPath } from "@/lib/routes";
import { LoginForms } from "./login-forms";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const params = await searchParams;
  return (
    <AuthShell
      title="Sign in to DevHub"
      description="Private operations console. Access is restricted to invited members."
      footer="Sessions are stored in secure, HTTP-only cookies. Two-factor authentication is requested when enabled on your account."
    >
      {params.error ? (
        <p role="alert" className="mb-4 rounded-lg border border-bad/30 bg-bad/10 px-3.5 py-2.5 text-[13px] text-bad">
          That sign-in link is invalid or has expired. Request a new one.
        </p>
      ) : null}
      <LoginForms next={safeNextPath(params.next)} allowSignup={allowSignup()} />
    </AuthShell>
  );
}
