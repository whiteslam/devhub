import {
  Activity,
  Blocks,
  CreditCard,
  FolderKanban,
  LayoutDashboard,
  type LucideIcon,
  Rocket,
  ScrollText,
  Settings,
  Siren,
  Users,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Shown only to roles that hold this permission (UX only; pages re-check). */
  permission?: "audit:read" | "billing:read";
}

export const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: "Portfolio",
    items: [
      { href: "/", label: "Overview", icon: LayoutDashboard },
      { href: "/projects", label: "Projects", icon: FolderKanban },
      { href: "/incidents", label: "Incidents & alerts", icon: Siren },
    ],
  },
  {
    title: "Delivery",
    items: [
      { href: "/deployments", label: "Deployments", icon: Rocket },
      { href: "/integrations", label: "Integrations", icon: Blocks },
    ],
  },
  {
    title: "Organization",
    items: [
      { href: "/business", label: "Business", icon: CreditCard, permission: "billing:read" },
      { href: "/team", label: "Team & access", icon: Users },
      { href: "/audit", label: "Audit log", icon: ScrollText, permission: "audit:read" },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

export const PROJECT_TABS = [
  { segment: "", label: "Overview" },
  { segment: "errors", label: "Errors" },
  { segment: "performance", label: "Performance" },
  { segment: "uptime", label: "Uptime" },
  { segment: "releases", label: "Releases" },
  { segment: "integrations", label: "Integrations" },
  { segment: "alerts", label: "Alerts" },
  { segment: "settings", label: "Settings" },
] as const;

export { Activity };
