/**
 * Migration check: applies every migration to a fresh PostgreSQL (PGlite)
 * with a Supabase auth shim, then asserts the security invariants that every
 * schema change must keep.
 */
import { createTestDatabase } from "../src/testing/index";

const failures: string[] = [];
const started = performance.now();
const { db, migrations, close } = await createTestDatabase();

const tables = await db.query<{ name: string; rls: boolean }>(`
  select c.relname as name, c.relrowsecurity as rls
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p') order by 1`);

for (const t of tables.rows) {
  if (!t.rls) failures.push(`RLS is not enabled on public.${t.name}`);
}

const anonGrants = await db.query<{ table_name: string; privilege_type: string }>(`
  select table_name, privilege_type from information_schema.role_table_grants
  where grantee = 'anon' and table_schema = 'public'`);
for (const g of anonGrants.rows) failures.push(`anon has ${g.privilege_type} on public.${g.table_name}`);

const clientWrites = await db.query<{ table_name: string; privilege_type: string }>(`
  select table_name, privilege_type from information_schema.role_table_grants
  where grantee = 'authenticated' and table_schema = 'public' and privilege_type in ('INSERT', 'DELETE', 'TRUNCATE')`);
for (const g of clientWrites.rows) {
  failures.push(`authenticated has table-wide ${g.privilege_type} on public.${g.table_name}; use an RPC instead`);
}

const secretColumns = await db.query<{ table_name: string; column_name: string }>(`
  select table_name, column_name from information_schema.column_privileges
  where grantee in ('anon', 'authenticated') and privilege_type = 'SELECT'
    and column_name in ('secret_hash', 'credentials_ciphertext')`);
for (const c of secretColumns.rows) failures.push(`clients can read ${c.table_name}.${c.column_name}`);

const definers = await db.query<{ name: string; config: string[] | null }>(`
  select n.nspname || '.' || p.proname as name, p.proconfig as config
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where p.prosecdef and n.nspname in ('public', 'app')`);
for (const f of definers.rows) {
  if (!f.config?.some((c) => c.startsWith("search_path="))) {
    failures.push(`SECURITY DEFINER function ${f.name} does not pin search_path`);
  }
}

const publicExec = await db.query<{ name: string }>(`
  select p.proname as name from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'EXECUTE')`);
for (const f of publicExec.rows) failures.push(`anon can execute public.${f.name}`);

await close();
const ms = Math.round(performance.now() - started);

console.log(`Applied ${migrations.length} migrations in ${ms} ms:`);
for (const m of migrations) console.log(`  ✓ ${m.name}`);
console.log(`Checked ${tables.rows.length} public tables, ${definers.rows.length} SECURITY DEFINER functions.`);

if (failures.length) {
  console.error(`\n${failures.length} invariant violation(s):`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log("All migration invariants hold.");
