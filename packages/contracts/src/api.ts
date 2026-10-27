import { z } from "zod";

/** Stable machine-readable error codes for every versioned API. */
export const API_ERROR_CODES = [
  "bad_request",
  "unauthenticated",
  "forbidden",
  "not_found",
  "conflict",
  "payload_too_large",
  "rate_limited",
  "internal",
  "unavailable",
] as const;
export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.enum(API_ERROR_CODES),
    message: z.string(),
    requestId: z.string(),
    details: z.unknown().optional(),
  }),
});
export type ApiError = z.infer<typeof apiErrorSchema>;

export function apiError(code: ApiErrorCode, message: string, requestId: string, details?: unknown): ApiError {
  return { error: { code, message, requestId, ...(details === undefined ? {} : { details }) } };
}

/** Cursor pagination shared by list endpoints. */
export const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().max(200).optional(),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export const healthResponseSchema = z.object({
  status: z.enum(["ok", "degraded", "down"]),
  service: z.string(),
  version: z.string(),
  time: z.string(),
  checks: z.record(z.string(), z.object({ status: z.enum(["ok", "degraded", "down", "skipped"]), detail: z.string().optional() })),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;
