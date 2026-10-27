# Security and permission model

## Roles and permissions

Roles are ordered `viewer < developer < operator < admin < owner`, but **no
role is "allow all"**: each is an explicit permission list in
`packages/auth/src/permissions.ts`, and every privileged action checks one
named permission. The database encodes the same ladder in
`app.has_org_role()` / `app.has_project_role()`.

| Permission                                                         | viewer | developer | operator | admin | owner |
| ------------------------------------------------------------------ | :----: | :-------: | :------: | :---: | :---: |
| Read projects, telemetry, members                                  |   ✓    |     ✓     |    ✓     |   ✓   |   ✓   |
| Read credential metadata                                           |        |     ✓     |    ✓     |   ✓   |   ✓   |
| Triage issues, manage alert rules                                  |        |     ✓     |    ✓     |   ✓   |   ✓   |
| Deploy / rollback ★                                                |        |           |    ✓     |   ✓   |   ✓   |
| Create / update projects                                           |        |           |          |   ✓   |   ✓   |
| Archive project ★, manage credentials ★, integrations ★, members ★ |        |           |          |   ✓   |   ✓   |
| Read audit log                                                     |        |           |          |   ✓   |   ✓   |
| Billing read / manage ★, delete organization ★, security policy    |        |           |          |       |   ✓   |

★ = **sensitive**: checked again in the server with `authorize()` and require
explicit confirmation in the UI. Read access is separate from configuration
writes, and both are separate from operational writes (operators can deploy
but cannot change configuration).

## Multi-factor authentication (enforced in the database)

AAL2 (a verified TOTP code in this session) is required for **any** access to
an organization's data when either:

- the user has a verified authenticator — so a stolen password alone opens
  nothing, however the attacker signs in; or
- the organization has _Require MFA_ on — every member, **owners included**.

This is enforced centrally in `app.aal_satisfied()`, which gates
`app.user_org_ids()`, `app.org_role()` and `app.project_role()` — the helpers
every RLS policy and RPC uses — based on the **signed** `aal` JWT claim and
`auth.mfa_factors`. Calling PostgREST directly with an AAL1 token therefore
returns nothing. Only the user's own membership rows and organization metadata
(name, slug, policy) remain visible, so the dashboard can explain the step-up.

The dashboard mirrors the rule for UX: users with a factor are sent to
`/login/mfa`; members of an MFA-required org without a factor are sent to
`/mfa-setup`. Factor status is read from the Auth server (`getUser()`), never
from the session cookie, whose `user` object is unsigned.

**Project grants** (`project_members`) can elevate an existing org member on a
single project (e.g. a viewer made operator for one app). They never lower an
org role and stop applying when org membership ends (FK cascade).

## Enforcement layers

1. **Proxy** (`apps/web/src/proxy.ts`) — UX guard: refreshes the session and
   redirects signed-out visitors. Not relied on for security.
2. **Server** — `requireWorkspace()` verifies the JWT with `getClaims()` (never
   trusts `getSession()`), forces the TOTP step-up for users with an enrolled
   factor regardless of sign-in method, and resolves the active organization
   only from the user's own memberships. `requirePermission()` runs
   `authorize()` for each action.
3. **Database** — RLS on every table (CI-enforced), explicit minimal grants,
   column-level grants for updatable/readable fields, `SECURITY DEFINER` RPCs
   with pinned `search_path` that re-check roles and MFA.

`pnpm db:check` fails the build if any public table lacks RLS, if `anon` has
any table grant or function execute right, if `authenticated` has table-wide
INSERT/DELETE, if secret columns are client-readable, or if a definer function
does not pin `search_path`.

## Tenant isolation

Every tenant row carries `organization_id`; child rows carry `project_id` with
**composite foreign keys** (`(project_id, organization_id) → projects`,
`(environment_id, project_id) → environments`), so even service-role code
cannot attach an event to another tenant's project. Tested in
`packages/database/src/rls.test.ts`.

## Secrets and credentials

| Secret                             | Storage                                                                                                                                        |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| User passwords, MFA secrets        | Supabase Auth only. DevHub never sees or stores them.                                                                                          |
| Server telemetry secrets (Phase 2) | HMAC-SHA256 digest only (`api_credentials.secret_hash`, not client-readable). Shown once at creation.                                          |
| Browser telemetry keys             | Public identifiers by design; scoped to ingestion, rate-limited, revocable.                                                                    |
| Provider tokens (Phase 4)          | AES-256-GCM ciphertext (`integrations.credentials_ciphertext`, not client-readable), key from `DEVHUB_ENCRYPTION_KEY`, versioned for rotation. |
| Supabase service-role key          | Server-only env of `apps/api`; never in the dashboard.                                                                                         |
| Payment data                       | Never stored; subscriptions mirror provider IDs and status only.                                                                               |

Audit snapshots strip `secret_hash`, `credentials_ciphertext` and payloads.

## Web protections

- **CSRF**: mutations are Server Actions (Next.js checks `Origin` against
  `Host`); cookies are `SameSite=Lax`, `HttpOnly`, `Secure` in production.
  The only GET with side effects is the PKCE auth callback.
- **Headers**: CSP (`default-src 'self'`, `connect-src 'self'`,
  `frame-ancestors 'none'`, `form-action 'self'`), HSTS, `nosniff`,
  `X-Frame-Options: DENY`, restrictive `Permissions-Policy`, `noindex`.
  `script-src` includes `'unsafe-inline'` because Next's bootstrap is inline;
  moving to nonce-based CSP is on the roadmap.
- **Open redirects / host-header injection**: `safeNextPath()` accepts only
  same-origin relative paths; auth email links and redirects are built only
  from `DEVHUB_APP_URL` (required in production) — never from `Host` or
  `X-Forwarded-Host`.
- **Account enumeration**: sign-in and magic-link responses are identical
  whether or not the account exists.
- **Rate limiting**: Supabase Auth's built-in limits, plus DevHub limits on
  its auth actions: 10 / 10 min per client IP and 10 / 15 min per account
  (email or user id) for password, magic-link and TOTP attempts. The client IP
  is taken `DEVHUB_TRUSTED_PROXY_HOPS` from the right of `X-Forwarded-For`, so
  client-supplied entries are ignored. Limits are held per instance — use a
  shared store before running multiple replicas (planned with ingestion rate
  limits in Phase 2).
- **Request IDs** are accepted from callers only in a safe shape
  (`[A-Za-z0-9._-]{8,100}`); they are informational and not trusted for
  authorization.
- **Error messages** returned to users come from an allow-list mapping
  (`mapDbError`); driver messages naming columns or echoing input are replaced.
- **Destructive actions** require typing the resource slug and are re-checked
  in the RPC; archiving keeps history.
- **Sessions**: users can revoke all sessions (“Sign out everywhere”).
  Refresh-token rotation is enabled in `supabase/config.toml`.

## Production checklist

- Disable public sign-up in Supabase Auth; invite users instead.
  (`DEVHUB_ALLOW_SIGNUP` only hides DevHub's sign-up form — if Supabase Auth
  sign-up stays on, anyone can create an account directly against Supabase and
  create their own, isolated organization.)
- Enable TOTP MFA in Supabase Auth and turn on _Require MFA_ in DevHub settings
  after enrolling every owner.
- Set `DEVHUB_APP_URL` to the public origin and add exactly
  `${DEVHUB_APP_URL}/auth/callback` to Supabase's redirect allow-list (no
  wildcards).
- Set `DEVHUB_TRUSTED_PROXY_HOPS` to the number of proxies in front of DevHub.
- Keep `DEVHUB_ALLOW_SIGNUP=false`.
- Schedule `app.prune_telemetry()` (see `database.md`).

## Security review log

**2026-10-27 — independent adversarial review of Phase 1.** Findings and
status:

| #   | Severity | Finding                                                                                                   | Status                                                                         |
| --- | -------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| H1  | High     | Step-up decided from the unsigned `user.factors` in the session cookie; editing it skipped TOTP           | Fixed: factors read via `getUser()`                                            |
| H2  | High     | Database enforced AAL only on two RPCs; AAL1 tokens could read data via PostgREST                         | Fixed: central `app.aal_satisfied()`; regression tests                         |
| M1  | Medium   | Auth email redirect origin derived from `Host` / `X-Forwarded-Host`                                       | Fixed: `DEVHUB_APP_URL` only; e2e test                                         |
| M2  | Medium   | Rate-limit key from client-controlled `X-Forwarded-For`; no per-account limit                             | Fixed: trusted-hop IP + per-account limiter (shared store still pending)       |
| L1  | Low      | Arbitrary `x-request-id` stored in audit rows                                                             | Fixed: validated in proxy; e2e test                                            |
| L2  | Low      | `alert_rules.channels` readable by viewers                                                                | Fixed: column grant; secrets belong in encrypted integration credentials       |
| L3  | Low      | Sign-up switch is UI-only                                                                                 | Documented (the Supabase Auth setting is the control)                          |
| L4  | Low      | App permission check could apply the active org's role to another org's project                           | Fixed: project must belong to the active org                                   |
| L5  | Low      | Some driver error messages reached users                                                                  | Fixed: generic messages                                                        |
| L6  | Low      | Some FKs not tenant-scoped (service-role paths)                                                           | Fixed: composite FKs; regression tests                                         |
| N1  | Medium   | (Re-review) `aal_satisfied()` depends on the migration role reading `auth.mfa_factors` on hosted Supabase | Resolved: verified on hosted Supabase (PG 17.11); the migration also guards it |
| N2  | Low      | Non-TOTP factors count for AAL but cannot be verified in the UI                                           | Documented limitation                                                          |
| N3  | Low      | Per-account limit can slow a known user's sign-in                                                         | Accepted trade-off                                                             |

Re-review on the same day re-ran the AAL probe (12 checks × 7 user/AAL cases)
and confirmed H1–L6 fixed with no regressions.
