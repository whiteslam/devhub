export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="var(--color-raised)" stroke="var(--color-line-strong)" />
      <path d="M9 9h7a7 7 0 0 1 0 14H9z" fill="none" stroke="var(--color-accent)" strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx="16" cy="16" r="2.5" fill="var(--color-ok)" />
    </svg>
  );
}
