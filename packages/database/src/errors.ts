import type { ApiErrorCode } from "@devhub/contracts";

export interface PostgresLikeError {
  code?: string | null;
  message: string;
}

export interface MappedDbError {
  code: ApiErrorCode;
  message: string;
}

/**
 * Translates PostgreSQL / PostgREST errors into DevHub API error codes with
 * messages that are safe to show users (no SQL, no constraint internals).
 */
export function mapDbError(error: PostgresLikeError): MappedDbError {
  switch (error.code) {
    case "42501":
      return {
        code: "forbidden",
        message: /two-factor/i.test(error.message)
          ? "This action requires two-factor verification."
          : "You do not have permission to do that.",
      };
    case "23505":
      return { code: "conflict", message: "That slug is already in use." };
    case "23514":
      return {
        code: "bad_request",
        message: /owner/i.test(error.message) ? "An organization must keep at least one owner." : "Some values are not valid.",
      };
    case "22023":
      // Raised by DevHub's own RPCs with user-facing messages.
      return { code: "bad_request", message: sanitize(error.message) };
    case "22P02":
    case "23502":
      // Driver messages name columns or echo input; keep them out of the UI.
      return { code: "bad_request", message: "Some values are not valid." };
    case "54000":
      return { code: "conflict", message: "You have reached the maximum number of organizations." };
    case "PGRST301":
    case "PGRST302":
      return { code: "unauthenticated", message: "Your session has expired. Sign in again." };
    default:
      return { code: "internal", message: "Something went wrong. Try again." };
  }
}

function sanitize(message: string): string {
  const first = message.split("\n")[0] ?? "";
  const clean = first.replace(/^ERROR:\s*/i, "");
  return clean.length > 0 && clean.length <= 160 ? capitalize(clean) : "Some values are not valid.";
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1) + (/[.!?]$/.test(value) ? "" : ".");
}
