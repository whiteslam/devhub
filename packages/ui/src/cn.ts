export type ClassValue = string | false | null | undefined;

/** Joins truthy class names. Components are written so later classes never need to override earlier ones. */
export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(" ");
}
