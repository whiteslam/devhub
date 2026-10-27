import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { getMemberships, requireStepUp } from "@/server/session";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "Create your organization" };

export default async function OnboardingPage() {
  await requireStepUp();
  if ((await getMemberships()).length) redirect("/");
  return (
    <AuthShell
      title="Create your organization"
      description="Organizations own projects, credentials and audit history. You will be its owner."
    >
      <OnboardingForm />
    </AuthShell>
  );
}
