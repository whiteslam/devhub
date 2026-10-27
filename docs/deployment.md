# Deployment

DevHub needs a Supabase project and somewhere to run two Node processes
(`web`, `api`). Both are stateless.

## 1. Supabase project

1. Create a project (choose the region closest to your apps).
2. Apply migrations: `supabase link --project-ref <ref>` then `supabase db push`.
3. **Authentication → Sign In / Providers**: disable "Allow new users to sign up".
4. **Authentication → Multi-Factor**: enable TOTP.
5. **Authentication → URL Configuration**: Site URL = your `DEVHUB_APP_URL`;
   add `https://<your-domain>/auth/callback` to Redirect URLs.
6. **Database → Extensions**: enable `pg_cron`, then schedule retention
   (see `database.md`).
7. Invite yourself (Authentication → Users → Invite) and sign in.
8. After enrolling your authenticator, enable _Require MFA_ in DevHub →
   Settings.

## 2. Configuration

| Variable                                       | Process  | Notes                                                        |
| ---------------------------------------------- | -------- | ------------------------------------------------------------ |
| `SUPABASE_URL`                                 | web, api | Project URL                                                  |
| `SUPABASE_PUBLISHABLE_KEY`                     | web      | Publishable (or legacy anon) key; low privilege, RLS applies |
| `DEVHUB_APP_URL`                               | web      | Public origin, e.g. `https://hq.example.com`                 |
| `DEVHUB_ALLOW_SIGNUP`                          | web      | `false` in production                                        |
| `PORT`, `MAX_BODY_BYTES`, `REQUEST_TIMEOUT_MS` | api      | Defaults are safe                                            |

Configuration is read at runtime, so the same image/build works in every
environment. No secrets are needed by the dashboard in Phase 1.

## 3. Run the processes

### Docker (any host, including Coolify)

```bash
docker build -f infrastructure/docker/web.Dockerfile -t devhub-web .
docker build -f infrastructure/docker/api.Dockerfile -t devhub-api .
docker run -p 3000:3000 -e SUPABASE_URL=… -e SUPABASE_PUBLISHABLE_KEY=… -e DEVHUB_APP_URL=… devhub-web
docker run -p 4000:4000 -e SUPABASE_URL=… devhub-api
```

Images run as a non-root user, include health checks (`/api/health`,
`/v1/health`), and work with a read-only root filesystem
(`infrastructure/docker/compose.yml`). In Coolify, point a Dockerfile
application at each Dockerfile with the repository root as build context.

### Vercel (dashboard)

Import the repository, set the root directory to `apps/web`, keep the default
build command, and set the environment variables above. Deploy `apps/api`
separately (Docker) — it is a long-running process.

## 4. Verify

```bash
curl -fsS https://hq.example.com/api/health
curl -fsS https://api.hq.example.com/v1/ready   # database: ok
```

Then sign in, confirm the MFA prompt appears, and check that Audit log records
your first actions.

## Release process

1. CI must be green (lint, types, migration invariants, tests, build, e2e,
   real-Supabase migration job).
2. Apply migrations **before** deploying code that depends on them
   (`supabase db push`); migrations are additive and backward-compatible with
   the previous release.
3. Deploy `web` and `api`; check health endpoints.
4. Roll back code by redeploying the previous image; schema changes are rolled
   forward with a new migration.
