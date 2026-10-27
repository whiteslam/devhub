"use client";

import { Field, Input } from "@devhub/ui";
import { useActionState } from "react";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { idle } from "@/server/action-state";
import { verifyMfa } from "@/server/actions/auth";

export function MfaForm({ next }: { next: string }) {
  const [state, action] = useActionState(verifyMfa, idle);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <Field label="Authentication code" htmlFor="code">
        <Input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          required
          autoFocus
          className="font-mono tracking-[0.4em]"
        />
      </Field>
      <FormMessage state={state} />
      <SubmitButton pendingLabel="Verifying…">Verify</SubmitButton>
    </form>
  );
}
