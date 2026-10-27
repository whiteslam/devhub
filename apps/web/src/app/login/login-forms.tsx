"use client";

import { Field, Input } from "@devhub/ui";
import { useActionState, useState } from "react";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { idle } from "@/server/action-state";
import { sendMagicLink, signInWithPassword, signUp } from "@/server/actions/auth";

type Mode = "password" | "link" | "signup";

export function LoginForms({ next, allowSignup }: { next: string; allowSignup: boolean }) {
  const [mode, setMode] = useState<Mode>("password");
  const [passwordState, passwordAction] = useActionState(signInWithPassword, idle);
  const [linkState, linkAction] = useActionState(sendMagicLink, idle);
  const [signupState, signupAction] = useActionState(signUp, idle);

  const tabs: [Mode, string][] = [
    ["password", "Password"],
    ["link", "Email link"],
    ...(allowSignup ? ([["signup", "Create account"]] as [Mode, string][]) : []),
  ];

  return (
    <div>
      <div
        role="tablist"
        aria-label="Sign-in method"
        className="mb-5 grid grid-flow-col gap-1 rounded-lg border border-line bg-surface p-1"
      >
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={mode === id}
            onClick={() => setMode(id)}
            className="h-8 rounded-md text-[13px] font-medium text-muted transition-colors aria-selected:bg-raised aria-selected:text-fg"
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "password" && (
        <form action={passwordAction} className="flex flex-col gap-4">
          <input type="hidden" name="next" value={next} />
          <Field label="Email" htmlFor="email">
            <Input id="email" name="email" type="email" autoComplete="username" required autoFocus />
          </Field>
          <Field label="Password" htmlFor="password">
            <Input id="password" name="password" type="password" autoComplete="current-password" required minLength={8} />
          </Field>
          <FormMessage state={passwordState} />
          <SubmitButton pendingLabel="Signing in…">Sign in</SubmitButton>
        </form>
      )}

      {mode === "link" && (
        <form action={linkAction} className="flex flex-col gap-4">
          <input type="hidden" name="next" value={next} />
          <Field label="Email" htmlFor="link-email" hint="We email you a one-time sign-in link.">
            <Input id="link-email" name="email" type="email" autoComplete="email" required autoFocus />
          </Field>
          <FormMessage state={linkState} />
          <SubmitButton pendingLabel="Sending…">Send sign-in link</SubmitButton>
        </form>
      )}

      {mode === "signup" && (
        <form action={signupAction} className="flex flex-col gap-4">
          <Field label="Email" htmlFor="signup-email">
            <Input id="signup-email" name="email" type="email" autoComplete="email" required autoFocus />
          </Field>
          <Field label="Password" htmlFor="signup-password" hint="At least 8 characters. Use a password manager.">
            <Input id="signup-password" name="password" type="password" autoComplete="new-password" required minLength={8} />
          </Field>
          <FormMessage state={signupState} />
          <SubmitButton pendingLabel="Creating…">Create account</SubmitButton>
        </form>
      )}
    </div>
  );
}
