"use client";

import { Button, Card, EmptyState } from "@devhub/ui";
import { TriangleAlert } from "lucide-react";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Card>
      <EmptyState
        icon={<TriangleAlert className="size-5" />}
        title="This view could not be loaded"
        description={`DevHub could not reach its database or hit an unexpected error. Nothing is shown rather than stale or guessed data.${error.digest ? ` Reference: ${error.digest}` : ""}`}
        action={<Button onClick={reset}>Retry</Button>}
      />
    </Card>
  );
}
