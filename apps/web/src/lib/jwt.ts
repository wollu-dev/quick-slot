/**
 * Decodes a JWT (JWS compact form: header.payload.signature) without verifying the signature.
 * Errors are codes; the UI translates them.
 */

export type JwtErrorCode = 'parts' | 'encrypted' | 'base64' | 'json';

export class JwtError extends Error {
  code: JwtErrorCode;
  part?: 'header' | 'payload';
  constructor(code: JwtErrorCode, part?: 'header' | 'payload') {
    super(`JWT ${code}${part ? ` (${part})` : ''}`);
    this.code = code;
    this.part = part;
  }
}

export interface DecodedJwt {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  /** The signature as it appears in the token (base64url) */
  signature: string;
}

function base64UrlDecode(s: string): string {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) throw new Error('not base64url');
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=');
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

export const base64UrlEncode = (text: string) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(text)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

function decodePart(s: string, part: 'header' | 'payload'): Record<string, unknown> {
  let text: string;
  try {
    text = base64UrlDecode(s);
  } catch {
    throw new JwtError('base64', part);
  }
  try {
    const v = JSON.parse(text);
    if (v && typeof v === 'object' && !Array.isArray(v)) return v;
  } catch {
    /* falls through */
  }
  throw new JwtError('json', part);
}

/** Accepts the token as pasted, including a leading "Bearer " and surrounding whitespace or quotes */
export function decodeJwt(input: string): DecodedJwt {
  const token = input.trim().replace(/^bearer\s+/i, '').replace(/^["']|["']$/g, '');
  const parts = token.split('.');
  if (parts.length === 5) throw new JwtError('encrypted');
  if (parts.length !== 3) throw new JwtError('parts');
  return { header: decodePart(parts[0], 'header'), payload: decodePart(parts[1], 'payload'), signature: parts[2] };
}

/** NumericDate claims (seconds since the epoch) as a Date, if the claim is a number */
export const claimDate = (v: unknown): Date | null => (typeof v === 'number' && Number.isFinite(v) ? new Date(v * 1000) : null);

export type JwtStatus = 'valid' | 'expired' | 'notYet' | 'noExpiry';

export function jwtStatus(payload: Record<string, unknown>, now = Date.now()): JwtStatus {
  const nbf = claimDate(payload.nbf);
  const exp = claimDate(payload.exp);
  if (nbf && nbf.getTime() > now) return 'notYet';
  if (exp) return exp.getTime() <= now ? 'expired' : 'valid';
  return 'noExpiry';
}
