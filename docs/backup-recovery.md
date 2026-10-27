# Backup and recovery

## What must be protected

| Data                                                                                   | Source of truth                                       | Recovery                                                                                                             |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Configuration, projects, memberships, audit log, incidents, deployments, subscriptions | Supabase Postgres                                     | Database backups (below)                                                                                             |
| Raw telemetry (`events`, `check_results`, raw metric buckets)                          | Supabase Postgres                                     | Backed up, but short-retention by design; loss is tolerable                                                          |
| User accounts, MFA factors                                                             | Supabase Auth (`auth` schema, same database)          | Included in database backups                                                                                         |
| Provider tokens (Phase 4)                                                              | Encrypted in Postgres; key in `DEVHUB_ENCRYPTION_KEY` | **Back up the encryption key separately** (password manager / secrets manager). Without it, re-connect integrations. |
| Code, migrations                                                                       | Git                                                   | Redeploy                                                                                                             |

The application processes hold no state.

## Backups

- **Supabase daily backups** are included on paid plans; enable
  **Point-in-Time Recovery** for production (RPO of minutes).
- **Independent logical backup** (recommended weekly, plus before risky
  migrations), stored outside Supabase, encrypted:

  ```bash
  supabase db dump --linked -f backup/schema.sql
  supabase db dump --linked --data-only -f backup/data.sql
  supabase db dump --linked --role-only -f backup/roles.sql
  ```

  Treat dumps as sensitive: they contain email addresses and audit history.

## Restore procedures

**Accidental data change (e.g. wrong project archived):** archived projects are
not deleted — clear `archived_at` with the service role and record why in the
incident notes. The audit log shows who changed what (`changes` holds the
before/after of each field).

**Logical corruption / bad migration:** restore with PITR to a timestamp just
before the change into a _new_ project, verify, then switch `SUPABASE_URL` (or
copy the affected tables back).

**Region or project loss:** create a new project, restore the latest dump
(`psql -f roles.sql`, `schema.sql`, `data.sql`), re-apply any newer migrations
with `supabase db push`, update environment variables, redeploy.

## Lost authenticator (account recovery)

Because the database requires AAL2 for every user with a verified factor, a
lost device locks that user out of all organization data. Recovery is a
deliberate, out-of-band operator action:

1. Verify the person's identity through a channel other than email.
2. In the Supabase dashboard → Authentication → Users → the user → remove the
   MFA factor (or `delete from auth.mfa_factors where user_id = '…'` as
   `postgres`).
3. Ask them to sign in and enroll a new authenticator immediately; if their
   organization requires MFA they are sent to enrollment automatically.
4. Record the recovery in your incident notes. (Factor removal happens in the
   `auth` schema and is not captured by DevHub's audit triggers.)

Owners should enroll a second authenticator (e.g. a password-manager TOTP) as
a backup. Recovery codes are on the roadmap.

## Drills

Restore the latest logical backup into a scratch project quarterly and run:

```sql
select count(*) from public.organizations;
select max(created_at) from public.audit_logs;
```

then sign in to a DevHub instance pointed at the scratch project. Record the
time taken (RTO) and the data age (RPO).
