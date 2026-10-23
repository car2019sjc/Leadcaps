import pg from 'pg';
import { readFile } from 'node:fs/promises';
export function createPool() {
  if (!process.env.DATABASE_URL) throw new Error('Configure DATABASE_URL.');
  return new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 4, connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000, statement_timeout: 15000 });
}
export async function migrate(pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(741309228)");
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT clock_timestamp())');
    const { rowCount } = await client.query('SELECT version FROM schema_migrations WHERE version = 1');
    if (!rowCount) {
      await client.query(await readFile(new URL('./migrations/001_initial.sql', import.meta.url), 'utf8'));
      await client.query('INSERT INTO schema_migrations(version) VALUES (1)');
    }
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
if (process.argv[1]?.endsWith('/db.mjs')) {
  const pool = createPool();
  try { await migrate(pool); console.log('Migração concluída.'); } finally { await pool.end(); }
}
