import { can } from "@devhub/auth";
import { Card, EmptyState } from "@devhub/ui";
import { CreditCard, Lock } from "lucide-react";
import type { Metadata } from "next";
import { ComingInPhase } from "@/components/coming-in-phase";
import { requireWorkspace } from "@/server/session";

export const metadata: Metadata = { title: "Business" };

export default async function BusinessPage() {
  const workspace = await requireWorkspace();
  if (!can(workspace.auth, "billing:read")) {
    return (
      <Card>
        <EmptyState
          icon={<Lock className="size-5" />}
          title="Owners only"
          description="Business and subscription data is visible to organization owners."
        />
      </Card>
    );
  }
  return (
    <ComingInPhase
      icon={CreditCard}
      phase={6}
      title="Products, plans & subscriptions"
      description="Subscription state mirrored from your payment provider via signed, idempotent webhooks. DevHub never stores card data, and nothing here is shown until a real provider is connected and tested."
      bullets={["Products, plans and entitlements", "Customer subscription status and renewals", "Operational cost reporting per project"]}
    />
  );
}
