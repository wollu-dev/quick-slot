/**
 * Accounts, browser side. Only for Pro features: every free tool works signed out.
 * Talks to the API's better-auth routes (/api/auth/*) with plain fetch; the session is an HttpOnly cookie.
 * Returns codes, never text (the UI translates them).
 */

export type AccountError = 'invalidEmail' | 'rateLimited' | 'failed' | 'offline';

export class AccountFailure extends Error {
  code: AccountError;
  constructor(code: AccountError) {
    super(code);
    this.code = code;
  }
}

export interface Providers {
  enabled: boolean;
  email: boolean;
  google: boolean;
  apple: boolean;
}

export interface AccountUser {
  email: string;
  name: string;
}

/** Fired on window when someone signs in or out in this tab */
export const ACCOUNT_EVENT = 'quickslot:account';
const changed = () => window.dispatchEvent(new Event(ACCOUNT_EVENT));

async function call(path: string, body?: object): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
      cache: 'no-store',
    });
  } catch {
    throw new AccountFailure('offline');
  }
  if (res.ok) return res;
  if (res.status === 429) throw new AccountFailure('rateLimited');
  if (res.status === 400) throw new AccountFailure('invalidEmail');
  throw new AccountFailure(res.status >= 500 ? 'offline' : 'failed');
}

/** Which sign-in methods the server offers; null when the API can't be reached (accounts hidden) */
export async function getProviders(): Promise<Providers | null> {
  try {
    const res = await fetch('/api/account/providers', { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as Providers;
  } catch {
    return null;
  }
}

export async function getUser(): Promise<AccountUser | null> {
  const res = await call('/api/auth/get-session');
  const body = (await res.json()) as { user?: AccountUser } | null;
  return body?.user ? { email: body.user.email, name: body.user.name } : null;
}

/** Where to come back after signing in: the page the user is on */
const here = () => location.pathname + location.search;

export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

export async function sendSignInLink(email: string, lang: string): Promise<void> {
  if (!isEmail(email)) throw new AccountFailure('invalidEmail');
  await call('/api/auth/sign-in/magic-link', { email: email.trim(), callbackURL: here(), errorCallbackURL: here(), metadata: { lang } });
}

/** Leaves the page for Google or Apple, which send the user back here signed in */
export async function signInWith(provider: 'google' | 'apple'): Promise<void> {
  const res = await call('/api/auth/sign-in/social', { provider, callbackURL: here(), errorCallbackURL: here() });
  const { url } = (await res.json()) as { url?: string };
  if (!url) throw new AccountFailure('failed');
  location.assign(url);
}

export async function signOut(): Promise<void> {
  await call('/api/auth/sign-out', {});
  changed();
}

/** Deletes the account and everything tied to it */
export async function deleteAccount(): Promise<void> {
  await call('/api/auth/delete-user', {});
  changed();
}
