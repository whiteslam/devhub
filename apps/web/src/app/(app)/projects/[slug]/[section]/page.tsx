import { Activity, Blocks, Bug, Gauge, Rocket, Siren } from "lucide-react";
import { notFound } from "next/navigation";
import { ComingInPhase } from "@/components/coming-in-phase";

const SECTIONS = {
  errors: {
    icon: Bug,
    phase: 3,
    title: "Error tracking",
    description: "Grouped exceptions from the browser, Node.js and Next.js SDKs, correlated with releases.",
    bullets: [
      "Fingerprinting by exception type, normalized message and stack frames",
      "Status, severity, first/last seen and affected releases",
      "Regression detection after a resolve",
    ],
  },
  performance: {
    icon: Gauge,
    phase: 3,
    title: "Performance",
    description: "API latency percentiles, error rates and Web Vitals from pre-aggregated metric buckets.",
    bullets: ["p50 / p95 / p99 latency per route", "Error-rate and throughput trends", "LCP, INP and CLS from real users"],
  },
  uptime: {
    icon: Activity,
    phase: 3,
    title: "Uptime",
    description: "Scheduled HTTP checks per environment with response times and incident detection.",
    bullets: [
      "Checks every 30 s – 1 h",
      "Incident open and recovery on consecutive failures",
      "Missing-data detection: silence is never shown as up",
    ],
  },
  releases: {
    icon: Rocket,
    phase: 5,
    title: "Releases & deployments",
    description: "Deployment history from providers with release correlation and guarded rollback.",
    bullets: ["Vercel and Coolify deployment events", "Post-deploy health verification", "Audited, confirmed rollback requests"],
  },
  integrations: {
    icon: Blocks,
    phase: 4,
    title: "Integrations",
    description: "GitHub, Vercel, Coolify, Docker and Supabase adapters with declared capabilities.",
    bullets: ["Encrypted provider tokens, server-side only", "Signed webhooks with replay and duplicate protection"],
  },
  alerts: {
    icon: Siren,
    phase: 3,
    title: "Alert rules",
    description: "Thresholds on error rate, latency, uptime and missing data with notification routing.",
  },
} as const;

export default async function ProjectSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const config = SECTIONS[section as keyof typeof SECTIONS];
  if (!config) notFound();
  return <ComingInPhase {...config} bullets={"bullets" in config ? [...config.bullets] : undefined} />;
}
