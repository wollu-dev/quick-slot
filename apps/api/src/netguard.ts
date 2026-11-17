/**
 * Guards for requests the API makes to addresses users give it (server-side request forgery protection).
 * Only http(s) on the default ports, and only to public addresses: the check runs inside the socket's
 * DNS lookup, so the address that is checked is the address that is connected to (no DNS rebinding gap).
 */
import dns from 'node:dns';
import net from 'node:net';
import { config } from './config.ts';

export type TargetError = 'invalidUrl' | 'blockedAddress';

export class GuardError extends Error {
  code: TargetError;
  constructor(code: TargetError) {
    super(code);
    this.code = code;
  }
}

/** Parses a user-given address: http(s) only, default ports only, no credentials */
export function parseTarget(input: string): URL {
  let s = input.trim();
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = `https://${s}`;
  let url: URL;
  try {
    url = new URL(s);
  } catch {
    throw new GuardError('invalidUrl');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new GuardError('invalidUrl');
  if (url.username || url.password) throw new GuardError('invalidUrl');
  if (url.port && url.port !== '80' && url.port !== '443' && !config.allowPrivateTargets) throw new GuardError('blockedAddress');
  if (!url.hostname || url.hostname.length > 253) throw new GuardError('invalidUrl');
  return url;
}

const v4 = (a: string) => a.split('.').map(Number);

/** Loopback, private, link-local, carrier-grade NAT, multicast, reserved and documentation ranges */
export function isPrivateAddress(address: string): boolean {
  if (net.isIPv4(address)) {
    const [a, b] = v4(address);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  if (net.isIPv6(address)) {
    const x = address.toLowerCase();
    const mapped = x.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    return x === '::' || x === '::1' || x.startsWith('fc') || x.startsWith('fd') || x.startsWith('fe8') || x.startsWith('fe9') || x.startsWith('fea') || x.startsWith('feb') || x.startsWith('ff') || x.startsWith('64:ff9b') || x.startsWith('2001:db8');
  }
  return true;
}

/** A dns.lookup replacement for http(s).request that refuses private addresses */
export const guardedLookup: net.LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, '', 4);
    const list = addresses as dns.LookupAddress[];
    const ok = list.filter((a) => config.allowPrivateTargets || !isPrivateAddress(a.address));
    if (!ok.length) return callback(new GuardError('blockedAddress') as NodeJS.ErrnoException, '', 4);
    if ((options as dns.LookupOptions).all) return (callback as unknown as (e: null, a: dns.LookupAddress[]) => void)(null, ok);
    callback(null, ok[0].address, ok[0].family);
  });
};
