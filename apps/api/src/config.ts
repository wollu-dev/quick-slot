import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Settings from environment variables (documented in apps/api/.env.example and the README) */
const env = process.env;
const num = (v: string | undefined, fallback: number) => (v && Number.isFinite(Number(v)) ? Number(v) : fallback);

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string };

export const config = {
  port: num(env.PORT, 8787),
  /** Read the client address from X-Forwarded-For (set when running behind the bundled nginx) */
  trustProxy: env.TRUST_PROXY === 'true',
  rateLimitPerMinute: num(env.RATE_LIMIT_PER_MINUTE, 60),
  logRequests: env.LOG_REQUESTS !== 'false',
  /** Server time checks per client address per minute (each check sends about 20 requests to the site) */
  serverTimePerMinute: num(env.SERVER_TIME_PER_MINUTE, 6),
  /** yt-dlp command, and arguments to put before ours (YTDLP_ARGS, space separated; used by tests) */
  ytdlp: { cmd: env.YTDLP_PATH || 'yt-dlp', pre: (env.YTDLP_ARGS ?? '').split(' ').filter(Boolean) },
  /** Where downloads are written until they are sent (each job gets its own folder, removed afterwards) */
  videoWorkDir: env.VIDEO_WORK_DIR || join(tmpdir(), 'quickslot-video'),
  videoMaxMb: num(env.VIDEO_MAX_MB, 1024),
  videoMaxMinutes: num(env.VIDEO_MAX_MINUTES, 120),
  /** Downloads running at the same time on the whole server */
  videoConcurrent: num(env.VIDEO_CONCURRENT, 2),
  /** Downloads per client address per hour */
  videoPerHour: num(env.VIDEO_PER_HOUR, 10),
  /** Public address of the site (same as the web build's SITE_URL): sign-in links and cookie origin */
  siteUrl: (env.SITE_URL || 'http://localhost:4321').replace(/\/$/, ''),
  /** Accounts are on only when a database is set: postgres://… in production, pglite:<folder> for local development */
  databaseUrl: env.DATABASE_URL || '',
  /** Signs session cookies. Required in production; in development a random one is made at each start */
  authSecret: env.AUTH_SECRET || '',
  /** SMTP server for sign-in emails, e.g. smtps://user:pass@smtp.example.com:465 */
  smtpUrl: env.SMTP_URL || '',
  mailFrom: env.MAIL_FROM || 'QuickSlot <no-reply@localhost>',
  google: env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET ? { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET } : null,
  apple: env.APPLE_CLIENT_ID && env.APPLE_CLIENT_SECRET ? { clientId: env.APPLE_CLIENT_ID, clientSecret: env.APPLE_CLIENT_SECRET } : null,
  /** Only for tests: let outgoing requests reach private and loopback addresses */
  allowPrivateTargets: env.ALLOW_PRIVATE_TARGETS === 'true',
  version: pkg.version,
};
