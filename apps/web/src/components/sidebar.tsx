"use client";

import { cn, StatusDot, type Tone } from "@devhub/ui";
import { ChevronsUpDown, LogOut, Menu, Plus, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { signOut } from "@/server/actions/auth";
import { switchOrganization } from "@/server/actions/organizations";
import { Logo } from "./logo";
import { NAV_SECTIONS } from "./nav";

export interface SidebarProps {
  organizations: { id: string; name: string; role: string }[];
  activeOrganizationId: string;
  permissions: { "audit:read": boolean; "billing:read": boolean; "project:create": boolean };
  projects: { slug: string; name: string; tone: Tone; label: string }[];
  user: { email: string; aal: string; role: string };
}

export function Sidebar(props: SidebarProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  // Close the mobile drawer after navigation (state adjusted during render, no effect needed).
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setOpen(false);
  }

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-canvas/85 px-4 backdrop-blur lg:hidden">
        <Link href="/" className="flex items-center gap-2">
          <Logo size={24} />
          <span className="text-sm font-semibold">DevHub HQ</span>
        </Link>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="sidebar"
          aria-label={open ? "Close navigation" : "Open navigation"}
          className="grid size-9 place-items-center rounded-lg text-muted hover:bg-raised hover:text-fg"
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </header>
      {open ? <div className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={() => setOpen(false)} aria-hidden="true" /> : null}
      <aside
        id="sidebar"
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-line bg-surface transition-transform lg:sticky lg:top-0 lg:h-dvh lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <SidebarContent {...props} pathname={pathname} />
      </aside>
    </>
  );
}

function SidebarContent({
  organizations,
  activeOrganizationId,
  permissions,
  projects,
  user,
  pathname,
}: SidebarProps & { pathname: string }) {
  const active = organizations.find((o) => o.id === activeOrganizationId);
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));

  return (
    <>
      <div className="flex h-14 items-center gap-2.5 border-b border-line px-4">
        <Logo size={26} />
        <span className="text-sm font-semibold tracking-tight">DevHub HQ</span>
      </div>

      <form action={switchOrganization} className="border-b border-line px-3 py-3">
        <label htmlFor="org-switcher" className="sr-only">
          Organization
        </label>
        <div className="relative">
          <select
            id="org-switcher"
            name="organizationId"
            defaultValue={activeOrganizationId}
            onChange={(e) => e.currentTarget.form?.requestSubmit()}
            className="h-9 w-full appearance-none rounded-lg border border-line bg-canvas pl-3 pr-8 text-[13px] font-medium text-fg hover:border-line-strong focus-visible:outline-2 focus-visible:outline-accent"
          >
            {organizations.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          <ChevronsUpDown className="pointer-events-none absolute right-2.5 top-2.5 size-4 text-faint" aria-hidden="true" />
        </div>
        <noscript>
          <button type="submit" className="mt-2 text-xs text-accent">
            Switch
          </button>
        </noscript>
        {active ? <p className="mt-1.5 px-0.5 text-[11px] capitalize text-faint">{active.role}</p> : null}
      </form>

      <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 py-3">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title} className="mb-4">
            <p className="mb-1 px-2 text-[11px] font-medium uppercase tracking-wider text-faint">{section.title}</p>
            <ul className="flex flex-col gap-0.5">
              {section.items
                .filter((item) => !item.permission || permissions[item.permission])
                .map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={isActive(item.href) ? "page" : undefined}
                      className="flex h-8 items-center gap-2.5 rounded-md px-2 text-[13px] text-muted transition-colors hover:bg-raised hover:text-fg aria-[current=page]:bg-raised aria-[current=page]:text-fg"
                    >
                      <item.icon className="size-4 shrink-0" aria-hidden="true" />
                      {item.label}
                    </Link>
                  </li>
                ))}
            </ul>
          </div>
        ))}

        <div className="mb-2">
          <div className="mb-1 flex items-center justify-between px-2">
            <p className="text-[11px] font-medium uppercase tracking-wider text-faint">Projects</p>
            {permissions["project:create"] ? (
              <Link href="/projects/new" aria-label="New project" className="rounded p-0.5 text-faint hover:bg-raised hover:text-fg">
                <Plus className="size-3.5" />
              </Link>
            ) : null}
          </div>
          {projects.length ? (
            <ul className="flex flex-col gap-0.5">
              {projects.map((p) => (
                <li key={p.slug}>
                  <Link
                    href={`/projects/${p.slug}`}
                    aria-current={isActive(`/projects/${p.slug}`) ? "page" : undefined}
                    className="flex h-8 items-center gap-2.5 rounded-md px-2 text-[13px] text-muted hover:bg-raised hover:text-fg aria-[current=page]:bg-raised aria-[current=page]:text-fg"
                  >
                    <StatusDot tone={p.tone} />
                    <span className="truncate">{p.name}</span>
                    <span className="sr-only">({p.label})</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-2 text-xs text-faint">No projects yet.</p>
          )}
        </div>
      </nav>

      <div className="border-t border-line px-3 py-3">
        <div className="flex items-center gap-2.5 px-1">
          <div className="grid size-8 shrink-0 place-items-center rounded-full bg-raised text-xs font-semibold uppercase text-muted">
            {user.email.slice(0, 1) || "?"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] text-fg">{user.email}</p>
            <p className="text-[11px] text-faint">{user.aal === "aal2" ? "2FA verified" : "Password session"}</p>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              aria-label="Sign out"
              title="Sign out"
              className="grid size-8 place-items-center rounded-md text-faint hover:bg-raised hover:text-fg"
            >
              <LogOut className="size-4" />
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
