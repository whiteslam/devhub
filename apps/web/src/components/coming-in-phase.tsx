import { Badge, Card, EmptyState } from "@devhub/ui";
import type { LucideIcon } from "lucide-react";

/**
 * Honest placeholder for modules that are scheduled but not built yet.
 * It never renders sample numbers.
 */
export function ComingInPhase({
  icon: Icon,
  phase,
  title,
  description,
  bullets,
}: {
  icon: LucideIcon;
  phase: number;
  title: string;
  description: string;
  bullets?: string[];
}) {
  return (
    <Card>
      <EmptyState
        icon={<Icon className="size-5" />}
        title={
          <span className="inline-flex items-center gap-2">
            {title} <Badge tone="accent">Phase {phase}</Badge>
          </span>
        }
        description={description}
        action={
          bullets?.length ? (
            <ul className="mx-auto max-w-md space-y-1.5 text-left text-[13px] text-muted">
              {bullets.map((b) => (
                <li key={b} className="flex gap-2">
                  <span aria-hidden="true" className="mt-2 size-1 shrink-0 rounded-full bg-faint" />
                  {b}
                </li>
              ))}
            </ul>
          ) : undefined
        }
      />
    </Card>
  );
}
