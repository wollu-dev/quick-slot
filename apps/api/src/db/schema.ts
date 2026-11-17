/**
 * Database tables (Drizzle). The SQL that creates them is in ./migrations, applied at startup by migrate() in ./index.ts;
 * keep both in sync when you change a table.
 *
 * The four auth tables are the ones better-auth needs (user, session, account, verification).
 * We keep as little as possible: no IP addresses or user agents are stored (see auth.ts).
 */
import { boolean, index, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

const now = (name: string) => timestamp(name, { withTimezone: true }).notNull().defaultNow();

export const user = pgTable('user', {
  id: text().primaryKey(),
  name: text().notNull(),
  email: text().notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text(),
  createdAt: now('created_at'),
  updatedAt: now('updated_at'),
});

export const session = pgTable(
  'session',
  {
    id: text().primaryKey(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    token: text().notNull().unique(),
    createdAt: now('created_at'),
    updatedAt: now('updated_at'),
    // Always empty: auth.ts clears them before a session is saved
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (t) => [index('session_user_id_idx').on(t.userId)],
);

export const account = pgTable(
  'account',
  {
    id: text().primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
    scope: text(),
    password: text(),
    createdAt: now('created_at'),
    updatedAt: now('updated_at'),
  },
  (t) => [index('account_user_id_idx').on(t.userId)],
);

export const verification = pgTable(
  'verification',
  {
    id: text().primaryKey(),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: now('created_at'),
    updatedAt: now('updated_at'),
  },
  (t) => [index('verification_identifier_idx').on(t.identifier)],
);

export const schema = { user, session, account, verification };
