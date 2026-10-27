"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PROJECT_TABS } from "./nav";

export function ProjectTabs({ slug }: { slug: string }) {
  const pathname = usePathname();
  const base = `/projects/${slug}`;
  return (
    <nav aria-label="Project sections" className="-mx-4 mb-6 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1">
        {PROJECT_TABS.map((tab) => {
          const href = tab.segment ? `${base}/${tab.segment}` : base;
          const active = tab.segment ? pathname.startsWith(href) : pathname === base;
          return (
            <li key={tab.label}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className="relative flex h-10 items-center px-3 text-[13px] text-muted transition-colors hover:text-fg aria-[current=page]:text-fg aria-[current=page]:after:absolute aria-[current=page]:after:inset-x-2 aria-[current=page]:after:-bottom-px aria-[current=page]:after:h-0.5 aria-[current=page]:after:rounded-full aria-[current=page]:after:bg-accent"
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
