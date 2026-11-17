import { readFileSync } from 'node:fs';

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
  version: pkg.version,
};
