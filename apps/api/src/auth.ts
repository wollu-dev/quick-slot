/**
 * Accounts (better-auth). Only people who want Pro features sign in; every free tool works without an account.
 *
 * Kept to the minimum, as the privacy page promises:
 * - sign-in by emailed link, or Google / Apple when configured; no passwords
 * - sessions don't store the IP address or user agent
 * - no telemetry; the auth log never contains email addresses or links
 * - users can delete their account, which removes everything tied to it
 */
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError } from 'better-auth/api';
import { magicLink } from 'better-auth/plugins/magic-link';
import { hasRenewingSubscription } from './billing.ts';
import { config } from './config.ts';
import type { Db } from './db/index.ts';
import { schema } from './db/schema.ts';
import { signInMail, type Mailer } from './mail.ts';

/** Header the API sets itself with the client address it already worked out (see app.ts) */
export const CLIENT_IP_HEADER = 'x-quickslot-client-ip';

const maskEmails = (s: string) => s.replace(/[^\s@"'<>]+@[^\s@"'<>]+/g, '[email]');

export function createAuth(db: Db, mailer: Mailer | null) {
  const social: Record<string, { clientId: string; clientSecret: string }> = {};
  if (config.google) social.google = config.google;
  if (config.apple) social.apple = config.apple;

  const auth = betterAuth({
    appName: 'QuickSlot',
    baseURL: config.siteUrl,
    basePath: '/api/auth',
    secret: config.authSecret,
    trustedOrigins: [config.siteUrl],
    database: drizzleAdapter(db, { provider: 'pg', schema }),
    telemetry: { enabled: false },
    emailAndPassword: { enabled: false },
    socialProviders: social,
    user: {
      deleteUser: {
        enabled: true,
        // Deleting the account while a subscription still renews would leave the user paying for nothing
        beforeDelete: async (u) => {
          if (await hasRenewingSubscription(db, u.id)) throw new APIError('BAD_REQUEST', { message: 'activeSubscription' });
        },
      },
    },
    session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
    rateLimit: { enabled: true, window: 60, max: 30 },
    advanced: {
      useSecureCookies: config.siteUrl.startsWith('https://'),
      ipAddress: { ipAddressHeaders: [CLIENT_IP_HEADER] },
    },
    databaseHooks: {
      session: {
        create: {
          // Sessions don't need to know where or on what you signed in
          before: async (s) => ({ data: { ...s, ipAddress: null, userAgent: null } }),
        },
      },
    },
    logger: {
      level: 'error',
      log: (level, message) => console.error(`[auth] ${level}: ${maskEmails(String(message)).split('\n')[0]}`),
    },
    plugins: mailer
      ? [
          magicLink({
            expiresIn: 10 * 60,
            storeToken: 'hashed',
            sendMagicLink: async ({ email, url, metadata }) => mailer(signInMail(email, url, metadata?.lang)),
          }),
        ]
      : [],
  });
  return auth;
}

export type Auth = ReturnType<typeof createAuth>;

/** Which sign-in methods the site should offer */
export const providers = (mailer: Mailer | null) => ({
  email: !!mailer,
  google: !!config.google,
  apple: !!config.apple,
});
