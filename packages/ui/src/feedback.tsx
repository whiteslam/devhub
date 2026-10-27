import type { ReactNode } from "react";
import { cn } from "./cn";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)}>
      {icon ? <div className="mb-4 grid size-11 place-items-center rounded-xl border border-line bg-raised text-muted">{icon}</div> : null}
      <h3 className="text-sm font-semibold text-fg">{title}</h3>
      {description ? <p className="mt-1.5 max-w-md text-[13px] leading-relaxed text-muted">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded-md bg-raised", className)} />;
}

export function Alert({ tone = "bad", title, children }: { tone?: "bad" | "warn" | "accent"; title?: ReactNode; children: ReactNode }) {
  const tones = {
    bad: "border-bad/30 bg-bad/10 text-bad",
    warn: "border-warn/30 bg-warn/10 text-warn",
    accent: "border-accent/30 bg-accent/10 text-accent",
  };
  return (
    <div role={tone === "bad" ? "alert" : "status"} className={cn("rounded-lg border px-3.5 py-2.5 text-[13px]", tones[tone])}>
      {title ? <p className="font-medium">{title}</p> : null}
      <div className={cn(title ? "mt-0.5 opacity-90" : undefined)}>{children}</div>
    </div>
  );
}
