"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { allowSignup } from "@/env";
import { safeNextPath } from "@/lib/routes";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { type ActionState, formText } from "../action-state";
import { accountLimiter, authLimiter } from "../rate-limit";
import { appOrigin, clientKey } from "../request";
import { requireViewer } from "../session";

const emailSchema = z.email("Enter a valid email address.").max(320);
const credentialsSchema = z.object({ email: emailSchema, password: z.string().min(8, "At least 8 characters.").max(200) });
const totpSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Enter the 6-digit code from your authenticator app.");

const TOO_MANY: ActionState = { ok: false, message: "Too many attempts. Wait a few minutes and try again." };

export async function signInWithPassword(_: ActionState, formData: FormData): Promise<ActionState> {
  if (!authLimiter.take(await clientKey("login"))) return TOO_MANY;
  const parsed = credentialsSchema.safeParse({ email: formText(formData, "email"), password: formText(formData, "password") });
  if (!parsed.success) return { ok: false, message: "Enter your email and password." };
  // Per-account limit as well, so rotating IPs does not allow unlimited guessing.
  if (!accountLimiter.take(`login:${parsed.data.email.toLowerCase()}`)) return TOO_MANY;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  // One generic message: never reveal whether the account exists.
  if (error) return { ok: false, message: "Incorrect email or password." };

  const next = safeNextPath(formText(formData, "next"));
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
    redirect(`/login/mfa?next=${encodeURIComponent(next)}`);
  }
  redirect(next);
}

export async function sendMagicLink(_: ActionState, formData: FormData): Promise<ActionState> {
  if (!authLimiter.take(await clientKey("magic"))) return TOO_MANY;
  const parsed = emailSchema.safeParse(formText(formData, "email"));
  if (!parsed.success) return { ok: false, message: "Enter a valid email address." };
  if (!accountLimiter.take(`magic:${parsed.data.toLowerCase()}`)) return TOO_MANY;

  const next = safeNextPath(formText(formData, "next"));
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: {
      shouldCreateUser: allowSignup(),
      emailRedirectTo: `${appOrigin()}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  // Same response whether or not the account exists.
  return { ok: true, message: "If that address has an account, a sign-in link is on its way." };
}

export async function signUp(_: ActionState, formData: FormData): Promise<ActionState> {
  if (!allowSignup()) return { ok: false, message: "Sign-up is disabled for this DevHub instance." };
  if (!authLimiter.take(await clientKey("signup"))) return TOO_MANY;
  const parsed = credentialsSchema.safeParse({ email: formText(formData, "email"), password: formText(formData, "password") });
  if (!parsed.success) return { ok: false, message: "Use a valid email and a password of at least 8 characters." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signUp({
    ...parsed.data,
    options: { emailRedirectTo: `${appOrigin()}/auth/callback` },
  });
  if (error) return { ok: false, message: "Could not create the account. Try a different password or sign in." };
  return { ok: true, message: "Check your inbox to confirm your email address." };
}

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login");
}

/** Signs out every session of this user on every device. */
export async function signOutEverywhere(): Promise<void> {
  await requireViewer();
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut({ scope: "global" });
  redirect("/login");
}

export async function verifyMfa(_: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireViewer();
  if (!authLimiter.take(await clientKey("mfa")) || !accountLimiter.take(`mfa:${viewer.userId}`)) return TOO_MANY;
  const code = totpSchema.safeParse(formText(formData, "code"));
  if (!code.success) return { ok: false, message: code.error.issues[0]?.message ?? "Invalid code." };

  const supabase = await createSupabaseServerClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const factor = factors?.totp[0];
  if (!factor) return { ok: false, message: "No authenticator is enrolled on this account." };
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: code.data });
  if (error) return { ok: false, message: "That code did not match. Try the next one." };
  redirect(safeNextPath(formText(formData, "next")));
}

export interface EnrollmentState extends ActionState {
  factorId?: string;
  qrCode?: string;
  secret?: string;
}

export async function startTotpEnrollment(): Promise<EnrollmentState> {
  await requireViewer();
  const supabase = await createSupabaseServerClient();
  // Drop abandoned, unverified enrollments first.
  const { data: factors } = await supabase.auth.mfa.listFactors();
  for (const f of factors?.all ?? []) {
    if (f.factor_type === "totp" && f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
  }
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: `DevHub ${new Date().toISOString().slice(0, 10)}`,
  });
  if (error || !data) return { ok: false, message: "Could not start enrollment. Check that TOTP MFA is enabled in Supabase Auth." };
  return { ok: true, factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
}

export async function confirmTotpEnrollment(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireViewer();
  const code = totpSchema.safeParse(formText(formData, "code"));
  if (!code.success) return { ok: false, message: code.error.issues[0]?.message ?? "Invalid code." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: formText(formData, "factorId"), code: code.data });
  if (error) return { ok: false, message: "That code did not match. Scan the QR code again or wait for the next code." };
  redirect("/settings/security?enrolled=1");
}

export async function removeTotpFactor(formData: FormData): Promise<void> {
  const viewer = await requireViewer();
  // Removing a factor weakens the account: it requires a verified second factor now.
  if (viewer.aal !== "aal2") redirect("/login/mfa?next=/settings/security");
  const supabase = await createSupabaseServerClient();
  await supabase.auth.mfa.unenroll({ factorId: formText(formData, "factorId") });
  redirect("/settings/security");
}
