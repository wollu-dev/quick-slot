/**
 * Database connection. DATABASE_URL picks the driver:
 * - postgres://… or postgresql://…  a Postgres server (production, docker-compose)
 * - pglite:<folder> or pglite:memory  PGlite, Postgres running inside Node (local development and tests;
 *   it is a dev dependency, so it is not in the production image)
 */
import { mkdir, readdir, readFile } from 'node:fs/promises';
import { sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { schema } from './schema.ts';

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export async function connect(url: string): Promise<{ db: Db; close: () => Promise<void> }> {
  if (url.startsWith('pglite:')) {
    const where = url.slice('pglite:'.length);
    const { PGlite } = await import('@electric-sql/pglite');
    const { drizzle } = await import('drizzle-orm/pglite');
    // PGlite doesn't create missing parent folders
    if (where !== 'memory') await mkdir(where, { recursive: true });
    const client = where === 'memory' ? new PGlite() : new PGlite(where);
    return { db: drizzle({ client, schema }) as unknown as Db, close: () => client.close() };
  }
  if (!/^postgres(ql)?:\/\//.test(url)) throw new Error('DATABASE_URL must start with postgres://, postgresql:// or pglite:');
  const { default: postgres } = await import('postgres');
  const { drizzle } = await import('drizzle-orm/postgres-js');
  const client = postgres(url, { max: 10, onnotice: () => {} });
  return { db: drizzle({ client, schema }) as unknown as Db, close: () => client.end() };
}

/** Rows of a raw query: postgres.js returns them as an array, PGlite as `{ rows }` */
export function rowsOf<T>(result: unknown): T[] {
  return (Array.isArray(result) ? result : ((result as { rows?: T[] }).rows ?? [])) as T[];
}

/** The core migrations; paid features (ee/) bring their own folder, applied after these */
export const CORE_MIGRATIONS = new URL('./migrations/', import.meta.url);

/**
 * Applies the .sql files that haven't run yet, folder by folder and in name order within a folder,
 * each in a transaction. File names must be unique across folders (ee files start with "ee_").
 */
export async function migrate(db: Db, dirs: URL[] = [CORE_MIGRATIONS]): Promise<string[]> {
  await db.execute(sql`CREATE TABLE IF NOT EXISTS quickslot_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
  const done = new Set(rowsOf<{ name: string }>(await db.execute(sql`SELECT name FROM quickslot_migrations`)).map((r) => r.name));
  const applied: string[] = [];
  for (const dir of dirs) {
    const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
    for (const file of files) {
      if (done.has(file)) continue;
      const text = await readFile(new URL(file, dir), 'utf8');
      // One statement per execute: prepared statements can't hold several
      const statements = text
        .split(/;\s*(?:\n|$)/)
        .map((s) => s.replace(/^\s*--.*$/gm, '').trim())
        .filter(Boolean);
      await db.transaction(async (tx) => {
        for (const s of statements) await tx.execute(sql.raw(s));
        await tx.execute(sql`INSERT INTO quickslot_migrations (name) VALUES (${file})`);
      });
      applied.push(file);
    }
  }
  return applied;
}
