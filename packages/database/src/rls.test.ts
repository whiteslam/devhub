import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase, type Querier, type TestDatabase } from "./testing/index";

let t: TestDatabase;
let alice: string; // owner of acme
let bob: string; // owner of globex (other tenant)
let dev: string; // developer in acme
let viewer: string; // viewer in acme
let acme: string;
let globex: string;

const project = (overrides: Record<string, unknown> = {}) => ({
  name: "Storefront",
  slug: "storefront",
  framework: "nextjs",
  app_type: "web_app",
  base_url: "https://shop.example.com",
  repository_url: null,
  hosting_provider: "vercel",
  release_strategy: "git_sha",
  monitoring_config: { uptimeEnabled: true },
  environments: [
    { name: "Production", slug: "production", kind: "production", base_url: null },
    { name: "Staging", slug: "staging", kind: "staging", base_url: null },
  ],
  ...overrides,
});

async function one<T>(q: Querier, sql: string, params: unknown[] = []): Promise<T> {
  const result = await q.query<T>(sql, params);
  return result.rows[0] as T;
}

async function createProjectAs(user: string, org: string, overrides = {}, aal: "aal1" | "aal2" = "aal1") {
  return t.asUser(
    user,
    (q) => one<{ id: string }>(q, "select public.create_project($1, $2) as id", [org, JSON.stringify(project(overrides))]),
    { aal },
  );
}

beforeAll(async () => {
  t = await createTestDatabase();
  alice = await t.createUser("alice@acme.test");
  bob = await t.createUser("bob@globex.test");
  dev = await t.createUser("dev@acme.test");
  viewer = await t.createUser("viewer@acme.test");
  acme = (await t.asUser(alice, (q) => one<{ id: string }>(q, "select public.create_organization('Acme', 'acme') as id"))).id;
  globex = (await t.asUser(bob, (q) => one<{ id: string }>(q, "select public.create_organization('Globex', 'globex') as id"))).id;
  await t.asService((q) =>
    q.query("insert into public.memberships (organization_id, user_id, role) values ($1, $2, 'developer'), ($1, $3, 'viewer')", [
      acme,
      dev,
      viewer,
    ]),
  );
}, 60_000);

afterAll(async () => {
  await t?.close();
});

describe("users and organizations", () => {
  it("mirrors auth.users into public.users", async () => {
    const row = await t.asUser(alice, (q) => one<{ email: string }>(q, "select email from public.users where id = $1", [alice]));
    expect(row.email).toBe("alice@acme.test");
  });

  it("makes the creator the owner and audits it", async () => {
    const membership = await t.asUser(alice, (q) =>
      one<{ role: string }>(q, "select role from public.memberships where organization_id = $1 and user_id = $2", [acme, alice]),
    );
    expect(membership.role).toBe("owner");
    const actions = await t.asUser(alice, (q) =>
      q.query<{ action: string; actor_id: string }>("select action, actor_id from public.audit_logs where organization_id = $1", [acme]),
    );
    expect(actions.rows.map((r) => r.action)).toEqual(expect.arrayContaining(["organizations.insert", "memberships.insert"]));
    expect(actions.rows.find((r) => r.action === "organizations.insert")?.actor_id).toBe(alice);
  });

  it("requires authentication to create an organization", async () => {
    await expect(t.asAnon((q) => q.query("select public.create_organization('X', 'xorg')"))).rejects.toThrow(/permission denied/);
  });

  it("refuses to remove the last owner", async () => {
    await expect(
      t.asService((q) => q.query("delete from public.memberships where organization_id = $1 and user_id = $2", [acme, alice])),
    ).rejects.toThrow(/at least one owner/);
  });
});

describe("tenant isolation", () => {
  let acmeProject: string;

  beforeAll(async () => {
    acmeProject = (await createProjectAs(alice, acme)).id;
  });

  it("hides other tenants' organizations, projects, environments and audit logs", async () => {
    const counts = await t.asUser(bob, async (q) => ({
      orgs: (await q.query("select 1 from public.organizations where id = $1", [acme])).rows.length,
      projects: (await q.query("select 1 from public.projects where organization_id = $1", [acme])).rows.length,
      envs: (await q.query("select 1 from public.environments where project_id = $1", [acmeProject])).rows.length,
      audit: (await q.query("select 1 from public.audit_logs where organization_id = $1", [acme])).rows.length,
      members: (await q.query("select 1 from public.memberships where organization_id = $1", [acme])).rows.length,
      users: (await q.query("select 1 from public.users where id = $1", [alice])).rows.length,
    }));
    expect(counts).toEqual({ orgs: 0, projects: 0, envs: 0, audit: 0, members: 0, users: 0 });
  });

  it("does not let a member of another tenant create projects there", async () => {
    await expect(createProjectAs(bob, acme, { slug: "intruder" })).rejects.toThrow(/not allowed/);
  });

  it("does not let a user update another tenant's project", async () => {
    const result = await t.asUser(bob, (q) => q.query("update public.projects set name = 'pwned' where id = $1", [acmeProject]));
    expect(result.affectedRows).toBe(0);
  });

  it("gives anon no table access", async () => {
    await expect(t.asAnon((q) => q.query("select * from public.projects"))).rejects.toThrow(/permission denied/);
  });

  it("rejects telemetry rows that point at another tenant's project", async () => {
    const env = await t.asService((q) =>
      one<{ id: string }>(q, "select id from public.environments where project_id = $1 limit 1", [acmeProject]),
    );
    await expect(
      t.asService((q) =>
        q.query(
          `insert into public.events (organization_id, project_id, environment_id, kind, occurred_at, idempotency_key, size_bytes, payload)
           values ($1, $2, $3, 'error', now(), 'evt_crosstenant', 2, '{}')`,
          [globex, acmeProject, env.id],
        ),
      ),
    ).rejects.toThrow(/foreign key/);
  });
});

describe("project registration", () => {
  it("creates the project with its environments and audits both", async () => {
    const { id } = await createProjectAs(alice, acme, { slug: "billing-api", name: "Billing API", app_type: "api", framework: "node" });
    const envs = await t.asUser(viewer, (q) =>
      q.query<{ slug: string }>("select slug from public.environments where project_id = $1 order by slug", [id]),
    );
    expect(envs.rows.map((e) => e.slug)).toEqual(["production", "staging"]);
    const audit = await t.asUser(alice, (q) =>
      q.query<{ action: string }>("select action from public.audit_logs where project_id = $1 order by created_at", [id]),
    );
    expect(audit.rows.map((r) => r.action)).toEqual(["projects.insert", "environments.insert", "environments.insert"]);
    const p = await t.asUser(alice, (q) =>
      one<{ connection_status: string }>(q, "select connection_status from public.projects where id = $1", [id]),
    );
    expect(p.connection_status).toBe("pending");
  });

  it("denies developers and viewers", async () => {
    await expect(createProjectAs(dev, acme, { slug: "dev-proj" })).rejects.toThrow(/not allowed/);
    await expect(createProjectAs(viewer, acme, { slug: "viewer-proj" })).rejects.toThrow(/not allowed/);
  });

  it("rejects duplicate slugs, missing production and invalid values", async () => {
    await expect(createProjectAs(alice, acme, { slug: "storefront" })).rejects.toThrow(/duplicate key/);
    await expect(
      createProjectAs(alice, acme, { slug: "no-prod", environments: [{ name: "Dev", slug: "dev", kind: "development" }] }),
    ).rejects.toThrow(/production environment/);
    await expect(createProjectAs(alice, acme, { slug: "bad-fw", framework: "cobol" })).rejects.toThrow(/check constraint/);
    await expect(createProjectAs(alice, acme, { slug: "Bad Slug" })).rejects.toThrow(/check constraint/);
    await expect(createProjectAs(alice, acme, { slug: "bad-url", base_url: "javascript:alert(1)" })).rejects.toThrow(/check constraint/);
  });

  it("blocks direct inserts from clients", async () => {
    await expect(
      t.asUser(alice, (q) =>
        q.query(
          `insert into public.projects (organization_id, name, slug, framework, app_type, hosting_provider, release_strategy)
           values ($1, 'Direct', 'direct', 'nextjs', 'web_app', 'vercel', 'git_sha')`,
          [acme],
        ),
      ),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("project updates", () => {
  let id: string;
  beforeAll(async () => {
    id = (await createProjectAs(alice, acme, { slug: "marketing", name: "Marketing" })).id;
  });

  it("lets admins edit configuration and records only the diff", async () => {
    await t.asUser(alice, (q) => q.query("update public.projects set name = 'Marketing Site' where id = $1", [id]));
    const entry = await t.asUser(alice, (q) =>
      one<{ changes: Record<string, { from: unknown; to: unknown }> }>(
        q,
        "select changes from public.audit_logs where target_id = $1 and action = 'projects.update' order by created_at desc limit 1",
        [id],
      ),
    );
    expect(entry.changes).toEqual({ name: { from: "Marketing", to: "Marketing Site" } });
  });

  it("silently filters updates from developers (RLS)", async () => {
    const result = await t.asUser(dev, (q) => q.query("update public.projects set name = 'Nope' where id = $1", [id]));
    expect(result.affectedRows).toBe(0);
  });

  it("never lets clients mark a project connected", async () => {
    await expect(
      t.asUser(alice, (q) => q.query("update public.projects set connection_status = 'connected' where id = $1", [id])),
    ).rejects.toThrow(/permission denied/);
  });

  it("project grants elevate a viewer on one project only", async () => {
    await t.asService((q) =>
      q.query("insert into public.project_members (organization_id, project_id, user_id, role) values ($1, $2, $3, 'admin')", [
        acme,
        id,
        viewer,
      ]),
    );
    const allowed = await t.asUser(viewer, (q) => q.query("update public.projects set name = 'Marketing (viewer)' where id = $1", [id]));
    expect(allowed.affectedRows).toBe(1);
    const other = await t.asService((q) =>
      one<{ id: string }>(q, "select id from public.projects where slug = 'storefront' and organization_id = $1", [acme]),
    );
    const denied = await t.asUser(viewer, (q) => q.query("update public.projects set name = 'X' where id = $1", [other.id]));
    expect(denied.affectedRows).toBe(0);
  });
});

describe("archiving (destructive, confirmed, MFA-aware)", () => {
  it("requires the slug as confirmation", async () => {
    const { id } = await createProjectAs(alice, acme, { slug: "old-site" });
    await expect(t.asUser(alice, (q) => q.query("select public.archive_project($1, 'wrong')", [id]))).rejects.toThrow(/confirmation/);
    await t.asUser(alice, (q) => q.query("select public.archive_project($1, 'old-site')", [id]));
    const p = await t.asService((q) =>
      one<{ archived_at: string | null }>(q, "select archived_at from public.projects where id = $1", [id]),
    );
    expect(p.archived_at).not.toBeNull();
  });

  it("requires AAL2 when the organization requires MFA — owners included", async () => {
    const { id } = await createProjectAs(alice, acme, { slug: "legacy" });
    await t.asUser(alice, (q) => q.query("select public.update_organization_security($1, true, 30)", [acme]));
    await expect(t.asUser(alice, (q) => q.query("select public.archive_project($1, 'legacy')", [id]))).rejects.toThrow(/not allowed/);
    // relaxing the MFA requirement itself needs AAL2
    await expect(t.asUser(alice, (q) => q.query("select public.update_organization_security($1, false, 30)", [acme]))).rejects.toThrow(
      /only owners/,
    );
    await t.asUser(alice, (q) => q.query("select public.archive_project($1, 'legacy')", [id]), { aal: "aal2" });
    await t.asUser(alice, (q) => q.query("select public.update_organization_security($1, false, 30)", [acme]), { aal: "aal2" });
  });

  it("restricts security settings to owners", async () => {
    await expect(t.asUser(dev, (q) => q.query("select public.update_organization_security($1, false, 7)", [acme]))).rejects.toThrow(
      /only owners/,
    );
  });
});

describe("credentials and secrets", () => {
  it("never exposes secret hashes to clients", async () => {
    const p = await t.asService((q) =>
      one<{ id: string }>(q, "select id from public.projects where slug = 'storefront' and organization_id = $1", [acme]),
    );
    await t.asService((q) =>
      q.query(
        `insert into public.api_credentials (organization_id, project_id, kind, name, public_id, secret_hash, scopes)
         values ($1, $2, 'server_secret', 'Server', 'dh_srv_test_0001', 'hmac-digest', '{events:write}')`,
        [acme, p.id],
      ),
    );
    const visible = await t.asUser(dev, (q) =>
      q.query<{ public_id: string }>("select public_id from public.api_credentials where project_id = $1", [p.id]),
    );
    expect(visible.rows).toEqual([{ public_id: "dh_srv_test_0001" }]);
    await expect(t.asUser(dev, (q) => q.query("select secret_hash from public.api_credentials"))).rejects.toThrow(/permission denied/);
    await expect(t.asUser(viewer, (q) => q.query("select * from public.api_credentials"))).rejects.toThrow(/permission denied/);
    const viewerRows = await t.asUser(viewer, (q) => q.query("select id from public.api_credentials where project_id = $1", [p.id]));
    expect(viewerRows.rows).toHaveLength(0);
    const audit = await t.asService((q) =>
      one<{ changes: Record<string, unknown> }>(q, "select changes from public.audit_logs where action = 'api_credentials.insert'"),
    );
    expect(audit.changes).not.toHaveProperty("secret_hash");
  });

  it("requires a hash exactly for server secrets", async () => {
    const p = await t.asService((q) =>
      one<{ id: string }>(q, "select id from public.projects where slug = 'storefront' and organization_id = $1", [acme]),
    );
    await expect(
      t.asService((q) =>
        q.query(
          `insert into public.api_credentials (organization_id, project_id, kind, name, public_id, secret_hash)
           values ($1, $2, 'browser_public', 'Browser', 'dh_pub_test_0001', 'should-not-exist')`,
          [acme, p.id],
        ),
      ),
    ).rejects.toThrow(/check constraint/);
  });
});

describe("audit log integrity", () => {
  it("is append-only, even for the service role", async () => {
    await expect(t.asService((q) => q.query("update public.audit_logs set action = 'tampered'"))).rejects.toThrow(/append-only/);
    await expect(t.asService((q) => q.query("delete from public.audit_logs"))).rejects.toThrow(/append-only/);
    await expect(t.asUser(alice, (q) => q.query("delete from public.audit_logs"))).rejects.toThrow(/permission denied/);
  });

  it("is readable by admins only", async () => {
    const devRows = await t.asUser(dev, (q) => q.query("select 1 from public.audit_logs where organization_id = $1", [acme]));
    expect(devRows.rows).toHaveLength(0);
  });
});

describe("telemetry tables", () => {
  let projectId: string;
  let envId: string;

  beforeAll(async () => {
    projectId = (await createProjectAs(alice, acme, { slug: "telemetry-app" })).id;
    envId = (
      await t.asService((q) =>
        one<{ id: string }>(q, "select id from public.environments where project_id = $1 and slug = 'production'", [projectId]),
      )
    ).id;
  });

  const insertEvent = (key: string, receivedAt = "now()") =>
    t.asService((q) =>
      q.query(
        `insert into public.events (organization_id, project_id, environment_id, kind, occurred_at, received_at, idempotency_key, size_bytes, payload)
         values ($1, $2, $3, 'error', now(), ${receivedAt}, $4, 2, '{}') on conflict (project_id, idempotency_key) do nothing`,
        [acme, projectId, envId, key],
      ),
    );

  it("deduplicates retried events by idempotency key", async () => {
    expect((await insertEvent("evt_retry_0001")).affectedRows).toBe(1);
    expect((await insertEvent("evt_retry_0001")).affectedRows).toBe(0);
  });

  it("blocks client writes to telemetry", async () => {
    await expect(
      t.asUser(alice, (q) =>
        q.query(
          `insert into public.events (organization_id, project_id, environment_id, kind, occurred_at, idempotency_key, size_bytes, payload)
           values ($1, $2, $3, 'error', now(), 'evt_client_01', 2, '{}')`,
          [acme, projectId, envId],
        ),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("allows developers to triage issues but not to forge regressions", async () => {
    const issue = await t.asService((q) =>
      one<{ id: string }>(
        q,
        `insert into public.issues (organization_id, project_id, fingerprint, title, first_seen_at, last_seen_at, occurrence_count)
         values ($1, $2, 'fp-1', 'TypeError: x is undefined', now(), now(), 3) returning id`,
        [acme, projectId],
      ),
    );
    const ok = await t.asUser(dev, (q) => q.query("update public.issues set status = 'resolved' where id = $1", [issue.id]));
    expect(ok.affectedRows).toBe(1);
    await expect(t.asUser(dev, (q) => q.query("update public.issues set status = 'regressed' where id = $1", [issue.id]))).rejects.toThrow(
      /row-level security/,
    );
    const viewerUpdate = await t.asUser(viewer, (q) => q.query("update public.issues set status = 'ignored' where id = $1", [issue.id]));
    expect(viewerUpdate.affectedRows).toBe(0);
    await expect(t.asUser(dev, (q) => q.query("update public.issues set occurrence_count = 0 where id = $1", [issue.id]))).rejects.toThrow(
      /permission denied/,
    );
  });

  it("prunes raw events past the organization's retention window", async () => {
    await insertEvent("evt_old_000001", "now() - interval '45 days'");
    const pruned = await t.asService((q) => q.query<{ table_name: string; deleted: number }>("select * from app.prune_telemetry(1000)"));
    expect(pruned.rows.find((r) => r.table_name === "events")?.deleted).toBe(1);
    const remaining = await t.asService((q) => q.query("select 1 from public.events where idempotency_key = 'evt_retry_0001'"));
    expect(remaining.rows).toHaveLength(1);
    await expect(t.asUser(alice, (q) => q.query("select * from app.prune_telemetry(10)"))).rejects.toThrow(/permission denied/);
  });
});

describe("assurance level (MFA) is enforced by the database", () => {
  let carol: string;
  let org: string;
  let projectId: string;

  beforeAll(async () => {
    carol = await t.createUser("carol@initech.test");
    org = (await t.asUser(carol, (q) => one<{ id: string }>(q, "select public.create_organization('Initech', 'initech') as id"))).id;
    projectId = (await createProjectAs(carol, org, { slug: "tps" })).id;
    const env = await t.asService((q) =>
      one<{ id: string }>(q, "select id from public.environments where project_id = $1 and slug = 'production'", [projectId]),
    );
    await t.asService((q) =>
      q.query(
        `insert into public.events (organization_id, project_id, environment_id, kind, occurred_at, idempotency_key, size_bytes, payload)
         values ($1, $2, $3, 'error', now(), 'evt_mfa_000001', 20, '{"secret":"payload"}')`,
        [org, projectId, env.id],
      ),
    );
    // carol enrolls an authenticator
    await t.db.query("insert into auth.mfa_factors (user_id, status) values ($1, 'verified')", [carol]);
  });

  const visible = (aal: "aal1" | "aal2") =>
    t.asUser(
      carol,
      async (q) => ({
        projects: (await q.query("select 1 from public.projects where organization_id = $1", [org])).rows.length,
        events: (await q.query("select 1 from public.events where organization_id = $1", [org])).rows.length,
        audit: (await q.query("select 1 from public.audit_logs where organization_id = $1", [org])).rows.length,
        ownMembership: (await q.query("select 1 from public.memberships where organization_id = $1", [org])).rows.length,
        org: (await q.query("select 1 from public.organizations where id = $1", [org])).rows.length,
      }),
      { aal },
    );

  it("a password-only session of a user with a verified factor opens no data", async () => {
    // Reviewer finding H1/H2: a stolen password (aal1) must not be enough, even calling PostgREST directly.
    expect(await visible("aal1")).toEqual({ projects: 0, events: 0, audit: 0, ownMembership: 1, org: 1 });
    await expect(createProjectAs(carol, org, { slug: "aal1-proj" })).rejects.toThrow(/not allowed/);
    const update = await t.asUser(carol, (q) => q.query("update public.projects set name = 'pwned' where id = $1", [projectId]));
    expect(update.affectedRows).toBe(0);
  });

  it("the same user at AAL2 has full access", async () => {
    const v = await visible("aal2");
    expect(v.projects).toBe(1);
    expect(v.events).toBe(1);
    expect(v.audit).toBeGreaterThan(0);
  });

  it("an org that requires MFA locks out members without AAL2, even if they have no factor", async () => {
    const dana = await t.createUser("dana@initech.test");
    await t.asService((q) =>
      q.query("insert into public.memberships (organization_id, user_id, role) values ($1, $2, 'viewer')", [org, dana]),
    );
    const before = await t.asUser(dana, (q) => q.query("select 1 from public.events where organization_id = $1", [org]));
    expect(before.rows).toHaveLength(1);
    await t.asUser(carol, (q) => q.query("select public.update_organization_security($1, true, 30)", [org]), { aal: "aal2" });
    const after = await t.asUser(dana, (q) => q.query("select 1 from public.events where organization_id = $1", [org]));
    expect(after.rows).toHaveLength(0);
    const orgRow = await t.asUser(dana, (q) =>
      one<{ require_mfa: boolean }>(q, "select require_mfa from public.organizations where id = $1", [org]),
    );
    expect(orgRow.require_mfa).toBe(true);
  });
});

describe("hardening from the security review", () => {
  it("does not expose alert channel configuration to clients", async () => {
    await t.asService((q) =>
      q.query(
        "insert into public.alert_rules (organization_id, name, kind, channels) values ($1, 'Errors', 'new_issue', '[{\"slack\":\"x\"}]')",
        [acme],
      ),
    );
    await expect(t.asUser(viewer, (q) => q.query("select channels from public.alert_rules"))).rejects.toThrow(/permission denied/);
    const rows = await t.asUser(viewer, (q) => q.query("select name from public.alert_rules where organization_id = $1", [acme]));
    expect(rows.rows).toHaveLength(1);
  });

  it("rejects cross-tenant references in deployments, incidents and webhook deliveries", async () => {
    const acmeProject = await t.asService((q) =>
      one<{ id: string; env: string }>(
        q,
        "select p.id, e.id as env from public.projects p join public.environments e on e.project_id = p.id where p.slug = 'storefront' and p.organization_id = $1 limit 1",
        [acme],
      ),
    );
    const globexIntegration = await t.asService((q) =>
      one<{ id: string }>(
        q,
        "insert into public.integrations (organization_id, provider, name) values ($1, 'vercel', 'Globex Vercel') returning id",
        [globex],
      ),
    );
    const globexRule = await t.asService((q) =>
      one<{ id: string }>(q, "insert into public.alert_rules (organization_id, name, kind) values ($1, 'G', 'uptime') returning id", [
        globex,
      ]),
    );
    await expect(
      t.asService((q) =>
        q.query(
          `insert into public.deployments (organization_id, project_id, environment_id, provider, status, trigger, integration_id)
           values ($1, $2, $3, 'vercel', 'ready', 'provider_event', $4)`,
          [acme, acmeProject.id, acmeProject.env, globexIntegration.id],
        ),
      ),
    ).rejects.toThrow(/foreign key/);
    await expect(
      t.asService((q) =>
        q.query(
          `insert into public.incidents (organization_id, project_id, title, severity, dedupe_key, alert_rule_id)
           values ($1, $2, 'x', 'minor', 'k', $3)`,
          [acme, acmeProject.id, globexRule.id],
        ),
      ),
    ).rejects.toThrow(/foreign key/);
    await expect(
      t.asService((q) =>
        q.query(
          `insert into public.webhook_deliveries (organization_id, integration_id, provider, delivery_id, signature_valid)
           values (null, $1, 'vercel', 'd-1', true)`,
          [globexIntegration.id],
        ),
      ),
    ).rejects.toThrow(/check constraint/);
  });
});
