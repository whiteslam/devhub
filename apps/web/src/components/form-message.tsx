import { Alert } from "@devhub/ui";
import type { ActionState } from "@/server/action-state";

export function FormMessage({ state }: { state: ActionState }) {
  if (!state.message) return null;
  return <Alert tone={state.ok ? "accent" : "bad"}>{state.message}</Alert>;
}
