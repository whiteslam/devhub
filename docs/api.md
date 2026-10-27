# API

## Conventions (all versions)

- Versioned paths: `/v1/...`. Breaking changes ship as `/v2`.
- **Request IDs**: send `x-request-id` (8–100 chars of `[A-Za-z0-9._-]`) or one
  is generated; it is echoed in the response header and in every error body.
- **Errors** use one envelope (`packages/contracts/src/api.ts`):

  ```json
  { "error": { "code": "not_found", "message": "No such endpoint.", "requestId": "…" } }
  ```

  Codes: `bad_request`, `unauthenticated`, `forbidden`, `not_found`,
  `conflict`, `payload_too_large`, `rate_limited`, `internal`, `unavailable`.
  Internal error details are logged, never returned.
- **Limits**: bodies above `MAX_BODY_BYTES` (default 512 KiB) → 413; requests
  exceeding `REQUEST_TIMEOUT_MS` (default 10 s) → 504.
- **Pagination**: cursor based (`limit` ≤ 100, opaque `cursor`), keyset on
  `(created_at, id)`.

## `apps/api` — available now

| Method | Path         | Description                                                                                   |
| ------ | ------------ | --------------------------------------------------------------------------------------------- |
| GET    | `/v1/health` | Liveness. Always 200 while the process serves requests.                                       |
| GET    | `/v1/ready`  | Readiness. 503 when the database probe fails; `checks.database` is `ok`, `down` or `skipped`. |

## `apps/web`

| Method | Path             | Description                                                 |
| ------ | ---------------- | ----------------------------------------------------------- |
| GET    | `/api/health`    | Dashboard liveness; reports whether Supabase is configured. |
| GET    | `/auth/callback` | PKCE completion for email links.                            |

Dashboard mutations (create organization, register / update / archive
project, security settings, MFA) are Server Actions, not public HTTP APIs.
Their database counterparts are the RPCs `create_organization`,
`create_project`, `archive_project`, `update_organization_security`.

## Planned (Phase 2–5)

| Method | Path                      | Auth                                                  |
| ------ | ------------------------- | ----------------------------------------------------- |
| POST   | `/v1/events`              | Browser key (public, origin-checked) or server secret |
| POST   | `/v1/metrics`             | Server secret                                         |
| POST   | `/v1/releases`            | Server secret (`releases:write`)                      |
| GET    | `/v1/projects/:id/health` | User session / personal token                         |
| GET    | `/v1/projects/:id/issues` | User session / personal token                         |
| POST   | `/v1/webhooks/:provider`  | Provider signature + replay window                    |

An OpenAPI document will be generated from the shared zod schemas once these
endpoints exist.
