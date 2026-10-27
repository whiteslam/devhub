"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/form-message";
import { SlugFields } from "@/components/slug-fields";
import { SubmitButton } from "@/components/submit-button";
import { idle } from "@/server/action-state";
import { createOrganization } from "@/server/actions/organizations";

export function OnboardingForm() {
  const [state, action] = useActionState(createOrganization, idle);
  return (
    <form action={action} className="flex flex-col gap-5">
      <SlugFields nameLabel="Organization name" namePlaceholder="Acme Labs" errors={state.fieldErrors} />
      <FormMessage state={state} />
      <SubmitButton pendingLabel="Creating…">Create organization</SubmitButton>
    </form>
  );
}
