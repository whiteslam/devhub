import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { readSupabaseEnv } from "@/env";

export const metadata: Metadata = { title: "Setup required" };
export const dynamic = "force-dynamic";

const steps = [
  ["Create a Supabase project", "or run one locally with the Supabase CLI (supabase start)."],
  ["Apply the migrations", "supabase db push — the SQL lives in supabase/migrations."],
  ["Configure the dashboard", "copy .env.example to apps/web/.env.local and set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY."],
  ["Create the owner account", "invite yourself from Supabase Auth, or start once with DEVHUB_ALLOW_SIGNUP=true."],
];

export default function SetupPage() {
  if (readSupabaseEnv()) redirect("/");
  return (
    <AuthShell
      title="Connect DevHub to Supabase"
      description="DevHub stores everything in your own Supabase project. Nothing is shown until it is connected — the dashboard never displays sample data."
      footer="See docs/local-development.md for the full guide."
    >
      <ol className="flex flex-col gap-3">
        {steps.map(([title, detail], i) => (
          <li key={title} className="flex gap-3 rounded-lg border border-line bg-surface px-4 py-3">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-raised font-mono text-xs text-muted">{i + 1}</span>
            <div>
              <p className="text-sm font-medium">{title}</p>
              <p className="mt-0.5 text-[13px] text-muted">{detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </AuthShell>
  );
}
