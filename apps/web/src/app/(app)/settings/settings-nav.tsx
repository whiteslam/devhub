import Link from "next/link";

export function SettingsNav({ active }: { active: "organization" | "security" }) {
  const items = [
    { id: "organization", href: "/settings", label: "Organization" },
    { id: "security", href: "/settings/security", label: "Security & sessions" },
  ] as const;
  return (
    <nav aria-label="Settings" className="mb-6 flex gap-1 border-b border-line">
      {items.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          aria-current={active === item.id ? "page" : undefined}
          className="relative flex h-10 items-center px-3 text-[13px] text-muted hover:text-fg aria-[current=page]:text-fg aria-[current=page]:after:absolute aria-[current=page]:after:inset-x-2 aria-[current=page]:after:-bottom-px aria-[current=page]:after:h-0.5 aria-[current=page]:after:bg-accent"
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
