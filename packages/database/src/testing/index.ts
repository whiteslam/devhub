import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite, type Transaction } from "@electric-sql/pglite";

const here = dirname(fileURLToPath(import.meta.url));
export const MIGRATIONS_DIR = join(here, "../../../../supabase/migrations");

export interface Migration {
  name: string;
  sql: string;
}

export async function loadMigrations(dir = MIGRATIONS_DIR): Promise<Migration[]> {
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  return Promise.all(files.map(async (name) => ({ name, sql: await readFile(join(dir, name), "utf8") })));
}

export type Querier = Pick<Transaction, "query" | "exec">;

export interface ActAs {
  /** Supabase Auth assurance level placed in the JWT `aal` claim. */
  aal?: "aal1" | "aal2";
}

export interface TestDatabase {
  db: PGlite;
  migrations: Migration[];
  /** Runs `fn` as the `authenticated` role with a JWT for `userId`, in a transaction. */
  asUser<T>(userId: string, fn: (q: Querier) => Promise<T>, options?: ActAs): Promise<T>;
  asAnon<T>(fn: (q: Querier) => Promise<T>): Promise<T>;
  asService<T>(fn: (q: Querier) => Promise<T>): Promise<T>;
  /** Inserts into auth.users (the sync trigger creates public.users). */
  createUser(email: string): Promise<string>;
  close(): Promise<void>;
}

export async function createTestDatabase(): Promise<TestDatabase> {
  const db = new PGlite();
  await db.exec(await readFile(join(here, "supabase-shim.sql"), "utf8"));
  const migrations = await loadMigrations();
  for (const migration of migrations) {
    try {
      await db.exec(migration.sql);
    } catch (error) {
      throw new Error(`Migration ${migration.name} failed: ${(error as Error).message}`, { cause: error });
    }
  }

  const run = <T>(role: string, claims: Record<string, unknown>, fn: (q: Querier) => Promise<T>) =>
    db.transaction(async (tx) => {
      await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
      await tx.exec(`set local role ${role}`);
      return fn(tx);
    });

  return {
    db,
    migrations,
    asUser: (userId, fn, options) => run("authenticated", { sub: userId, role: "authenticated", aal: options?.aal ?? "aal1" }, fn),
    asAnon: (fn) => run("anon", { role: "anon" }, fn),
    asService: (fn) => run("service_role", { role: "service_role" }, fn),
    async createUser(email) {
      const result = await db.query<{ id: string }>("insert into auth.users (email) values ($1) returning id", [email]);
      const row = result.rows[0];
      if (!row) throw new Error("failed to create user");
      return row.id;
    },
    close: () => db.close(),
  };
}
