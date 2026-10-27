import { buttonClasses } from "@devhub/ui";
import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main" className="grid min-h-dvh place-items-center px-6">
      <div className="text-center">
        <p className="font-mono text-xs text-faint">404</p>
        <h1 className="mt-2 text-lg font-semibold">Not found</h1>
        <p className="mt-1.5 text-sm text-muted">It may have been archived, or you may not have access to it.</p>
        <Link href="/" className={buttonClasses("secondary", "md", "mt-6")}>
          Back to overview
        </Link>
      </div>
    </main>
  );
}
