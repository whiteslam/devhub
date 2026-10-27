import type { ConnectionStatus } from "./catalog";

/**
 * Health shown on the dashboard. "unknown" and "stale" are first-class: a
 * project with no telemetry, or whose telemetry stopped arriving, is never
 * reported as healthy.
 */
export type HealthState = "healthy" | "degraded" | "stale" | "unknown";

export interface HealthInput {
  connectionStatus: ConnectionStatus;
  lastEventAt: string | Date | null;
  staleAfterMinutes: number;
  openIncidents: number;
}

export interface HealthSummary {
  state: HealthState;
  label: string;
  detail: string;
}

export function deriveHealth(input: HealthInput, now: Date = new Date()): HealthSummary {
  if (input.connectionStatus === "pending" || input.lastEventAt == null) {
    return { state: "unknown", label: "No data", detail: "No verified telemetry has been received yet." };
  }
  const last = typeof input.lastEventAt === "string" ? new Date(input.lastEventAt) : input.lastEventAt;
  const ageMinutes = (now.getTime() - last.getTime()) / 60_000;
  if (!Number.isFinite(ageMinutes) || ageMinutes > input.staleAfterMinutes) {
    return {
      state: "stale",
      label: "Stale",
      detail: `No telemetry for ${formatAge(ageMinutes)}; health cannot be confirmed.`,
    };
  }
  if (input.openIncidents > 0 || input.connectionStatus === "degraded") {
    return {
      state: "degraded",
      label: "Degraded",
      detail: input.openIncidents > 0 ? `${input.openIncidents} open incident(s).` : "Connection checks are failing.",
    };
  }
  if (input.connectionStatus === "partial") {
    return { state: "degraded", label: "Partial", detail: "Some required connection checks have not passed." };
  }
  return { state: "healthy", label: "Healthy", detail: `Telemetry received ${formatAge(ageMinutes)} ago.` };
}

export function formatAge(minutes: number): string {
  if (!Number.isFinite(minutes)) return "an unknown period";
  if (minutes < 1) return "less than a minute";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  if (minutes < 60 * 48) return `${Math.round(minutes / 60)} h`;
  return `${Math.round(minutes / 1440)} days`;
}
