import { AuthorizationError } from "@devhub/auth";
import { mapDbError, type PostgresLikeError } from "@devhub/database";
import type { z } from "zod";

export interface ActionState {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
}

export const idle: ActionState = { ok: false };

export function fromZodError(error: z.ZodError): ActionState {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return { ok: false, message: "Check the highlighted fields.", fieldErrors };
}

export function fromDbError(error: PostgresLikeError, field?: string): ActionState {
  const mapped = mapDbError(error);
  if (mapped.code === "conflict" && field) {
    return { ok: false, message: mapped.message, fieldErrors: { [field]: mapped.message } };
  }
  return { ok: false, message: mapped.message };
}

export function fromAuthorizationError(error: unknown): ActionState {
  if (error instanceof AuthorizationError) return { ok: false, message: error.message };
  throw error;
}

export function formText(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}
