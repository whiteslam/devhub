import { describe, expect, it } from "vitest";
import { deriveHealth } from "./health";

const now = new Date("2026-10-27T12:00:00Z");
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000).toISOString();

describe("deriveHealth", () => {
  it("never reports a project without telemetry as healthy", () => {
    expect(deriveHealth({ connectionStatus: "pending", lastEventAt: null, staleAfterMinutes: 60, openIncidents: 0 }, now).state).toBe(
      "unknown",
    );
    expect(deriveHealth({ connectionStatus: "connected", lastEventAt: null, staleAfterMinutes: 60, openIncidents: 0 }, now).state).toBe(
      "unknown",
    );
  });

  it("flags stale telemetry instead of assuming health", () => {
    const h = deriveHealth({ connectionStatus: "connected", lastEventAt: minutesAgo(90), staleAfterMinutes: 60, openIncidents: 0 }, now);
    expect(h.state).toBe("stale");
    expect(h.detail).toContain("2 h");
  });

  it("reports incidents and partial connections as degraded", () => {
    expect(
      deriveHealth({ connectionStatus: "connected", lastEventAt: minutesAgo(5), staleAfterMinutes: 60, openIncidents: 2 }, now).state,
    ).toBe("degraded");
    expect(
      deriveHealth({ connectionStatus: "partial", lastEventAt: minutesAgo(5), staleAfterMinutes: 60, openIncidents: 0 }, now).label,
    ).toBe("Partial");
  });

  it("is healthy only with fresh telemetry, a full connection and no incidents", () => {
    expect(
      deriveHealth({ connectionStatus: "connected", lastEventAt: minutesAgo(3), staleAfterMinutes: 60, openIncidents: 0 }, now).state,
    ).toBe("healthy");
  });
});
