import type { ReactNode } from "react";
import { Logo } from "./logo";

export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main id="main" className="shell-glow grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2.5">
          <Logo />
          <span className="text-sm font-semibold tracking-tight">DevHub HQ</span>
        </div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="mt-1.5 text-sm text-muted">{description}</p> : null}
        <div className="mt-6">{children}</div>
        {footer ? <div className="mt-8 text-xs text-faint">{footer}</div> : null}
      </div>
    </main>
  );
}
