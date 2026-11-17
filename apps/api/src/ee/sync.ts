/**
 * Sync between devices (Pro): the Quick Slot layout and the user's custom tools.
 *
 * Each item has a version. A device sends its change with the version it last saw; if another device
 * changed the item in between, the server answers 409 with its copy and the device decides (see the site's
 * ee/sync.ts). Only the shapes below are accepted, so nothing else can be stored here.
 */
import { and, eq } from 'drizzle-orm';
import { integer, jsonb, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';
import type { Context } from 'hono';
import type { Plugin } from '../app.ts';
import { requirePro } from '../billing.ts';
import { config } from '../config.ts';
import { user } from '../db/schema.ts';

export const syncItem = pgTable(
  'sync_item',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    key: text().notNull(),
    data: jsonb().notNull(),
    version: integer().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.key] })],
);

export const SYNC_KEYS = ['slots', 'customTools'] as const;
export type SyncKey = (typeof SYNC_KEYS)[number];
const MAX_BYTES = 64 * 1024;

const isHttpUrl = (s: unknown) => {
  if (typeof s !== 'string' || s.length > 2048) return false;
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
};

/** The only shapes that can be stored, matching the site's lib/slots.ts and lib/customTools.ts */
export function validItem(key: SyncKey, data: unknown): boolean {
  if (!Array.isArray(data)) return false;
  if (key === 'slots') return data.length <= 9 && data.every((s) => s === null || (typeof s === 'string' && s.length <= 80));
  return (
    data.length <= 50 &&
    data.every((t) => {
      if (!t || typeof t !== 'object' || Array.isArray(t)) return false;
      const o = t as Record<string, unknown>;
      const allowed = ['id', 'name', 'url', 'color', 'trusted'];
      return (
        Object.keys(o).every((k) => allowed.includes(k)) &&
        typeof o.id === 'string' &&
        o.id.length <= 40 &&
        typeof o.name === 'string' &&
        o.name.length <= 40 &&
        isHttpUrl(o.url) &&
        Number.isInteger(o.color) &&
        (o.trusted === undefined || typeof o.trusted === 'boolean')
      );
    })
  );
}

export const syncPlugin: Plugin = (app, { db, session }) => {
  const pro = requirePro(db, session);
  const userId = (c: Context) => c.get('userId' as never) as string;

  /** Everything synced for the user: { items: { slots: { data, version }, … } } */
  app.get('/api/sync', pro, async (c) => {
    const rows = await db.select().from(syncItem).where(eq(syncItem.userId, userId(c)));
    return c.json({ items: Object.fromEntries(rows.map((r) => [r.key, { data: r.data, version: r.version }])) });
  });

  /** Saves one item. Body { data, baseVersion }; 409 with the server's copy when baseVersion is out of date */
  app.put('/api/sync/:key', pro, async (c) => {
    if (c.req.header('origin') !== config.siteUrl) return c.json({ error: 'badOrigin' }, 403);
    const key = c.req.param('key') as SyncKey;
    if (!SYNC_KEYS.includes(key)) return c.json({ error: 'unknownKey' }, 404);
    const raw = await c.req.text();
    if (raw.length > MAX_BYTES) return c.json({ error: 'tooLarge' }, 413);
    let body: { data?: unknown; baseVersion?: unknown };
    try {
      body = JSON.parse(raw);
    } catch {
      return c.json({ error: 'invalid' }, 400);
    }
    if (!validItem(key, body.data) || !Number.isInteger(body.baseVersion)) return c.json({ error: 'invalid' }, 400);

    const id = userId(c);
    const where = and(eq(syncItem.userId, id), eq(syncItem.key, key));
    return db.transaction(async (tx) => {
      const [current] = await tx.select().from(syncItem).where(where).for('update');
      const have = current?.version ?? 0;
      if (have !== body.baseVersion) return c.json({ error: 'conflict', data: current?.data ?? null, version: have }, 409);
      const version = have + 1;
      if (current) await tx.update(syncItem).set({ data: body.data, version, updatedAt: new Date() }).where(where);
      else await tx.insert(syncItem).values({ userId: id, key, data: body.data, version });
      return c.json({ version });
    });
  });
};
