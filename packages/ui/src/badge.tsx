import type { ReactNode } from "react";
import { cn } from "./cn";

export type Tone = "neutral" | "accent" | "ok" | "warn" | "bad" | "unknown";

const TONES: Record<Tone, string> = {
  neutral: "bg-raised text-muted border-line",
  accent: "bg-accent/12 text-accent border-accent/25",
  ok: "bg-ok/12 text-ok border-ok/25",
  warn: "bg-warn/12 text-warn border-warn/25",
  bad: "bg-bad/12 text-bad border-bad/25",
  unknown: "bg-unknown/10 text-unknown border-unknown/20",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-medium",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const DOT: Record<Tone, string> = {
  neutral: "bg-muted",
  accent: "bg-accent",
  ok: "bg-ok shadow-[0_0_0_3px_rgb(74_222_128/0.15)]",
  warn: "bg-warn shadow-[0_0_0_3px_rgb(251_191_36/0.15)]",
  bad: "bg-bad shadow-[0_0_0_3px_rgb(248_113_113/0.18)]",
  unknown: "bg-transparent ring-1 ring-inset ring-unknown",
};

/** A status dot that never relies on colour alone: pair it with a text label. */
export function StatusDot({ tone, className }: { tone: Tone; className?: string }) {
  return <span aria-hidden="true" className={cn("inline-block size-2 shrink-0 rounded-full", DOT[tone], className)} />;
}
