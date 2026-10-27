"use client";

import { Button, Field, Input } from "@devhub/ui";
import { useActionState, useState, useTransition } from "react";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { idle } from "@/server/action-state";
import { confirmTotpEnrollment, type EnrollmentState, startTotpEnrollment } from "@/server/actions/auth";

export function MfaEnrollment() {
  const [enrollment, setEnrollment] = useState<EnrollmentState | null>(null);
  const [pending, startTransition] = useTransition();
  const [state, action] = useActionState(confirmTotpEnrollment, idle);

  if (!enrollment?.ok) {
    return (
      <div className="flex flex-col items-start gap-3">
        {enrollment?.message ? <p className="text-[13px] text-bad">{enrollment.message}</p> : null}
        <Button
          variant="primary"
          disabled={pending}
          onClick={() => startTransition(async () => setEnrollment(await startTotpEnrollment()))}
        >
          {pending ? "Preparing…" : "Set up authenticator app"}
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-5 sm:grid-cols-[176px_1fr]">
      {enrollment.qrCode ? (
        // biome-ignore lint/performance/noImgElement: data-URI SVG from Supabase; next/image adds nothing here
        <img
          src={enrollment.qrCode}
          alt="QR code for your authenticator app"
          width={176}
          height={176}
          className="rounded-lg bg-white p-2"
        />
      ) : null}
      <form action={action} className="flex flex-col gap-4">
        <input type="hidden" name="factorId" value={enrollment.factorId} />
        <p className="text-[13px] text-muted">
          Scan the code with 1Password, Authy or Google Authenticator, or enter this key manually:
          <code className="mt-1 block break-all rounded bg-canvas px-2 py-1 font-mono text-xs text-fg">{enrollment.secret}</code>
        </p>
        <Field label="6-digit code" htmlFor="enroll-code">
          <Input
            id="enroll-code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            required
            className="max-w-40 font-mono tracking-[0.3em]"
          />
        </Field>
        <FormMessage state={state} />
        <div>
          <SubmitButton pendingLabel="Verifying…">Verify and enable</SubmitButton>
        </div>
      </form>
    </div>
  );
}
