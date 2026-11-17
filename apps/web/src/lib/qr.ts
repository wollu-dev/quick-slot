/** Payload formats understood by phone camera apps */

export type QrKind = 'text' | 'wifi' | 'contact' | 'email' | 'phone' | 'sms';

export interface WifiData {
  ssid: string;
  password: string;
  security: 'WPA' | 'WEP' | 'nopass';
  hidden: boolean;
}
export interface ContactData {
  name: string;
  org: string;
  phone: string;
  email: string;
  url: string;
}
export interface EmailData {
  to: string;
  subject: string;
  body: string;
}
export interface SmsData {
  number: string;
  message: string;
}

/** Backslash-escape the characters that are special in WIFI: and MECARD-like strings */
const escWifi = (s: string) => s.replace(/([\\;,:"])/g, '\\$1');
/** vCard text values escape backslash, comma, semicolon and newlines */
const escVcard = (s: string) => s.replace(/\\/g, '\\\\').replace(/([,;])/g, '\\$1').replace(/\r?\n/g, '\\n');

export function wifiPayload(w: WifiData): string {
  const parts = [`T:${w.security}`, `S:${escWifi(w.ssid)}`];
  if (w.security !== 'nopass') parts.push(`P:${escWifi(w.password)}`);
  if (w.hidden) parts.push('H:true');
  return `WIFI:${parts.join(';')};;`;
}

export function contactPayload(c: ContactData): string {
  const lines = ['BEGIN:VCARD', 'VERSION:3.0', `N:${escVcard(c.name)};;;;`, `FN:${escVcard(c.name)}`];
  if (c.org) lines.push(`ORG:${escVcard(c.org)}`);
  if (c.phone) lines.push(`TEL;TYPE=CELL:${c.phone.trim()}`);
  if (c.email) lines.push(`EMAIL:${c.email.trim()}`);
  if (c.url) lines.push(`URL:${c.url.trim()}`);
  lines.push('END:VCARD');
  return lines.join('\r\n');
}

export function emailPayload(e: EmailData): string {
  const q = [e.subject && `subject=${encodeURIComponent(e.subject)}`, e.body && `body=${encodeURIComponent(e.body)}`].filter(Boolean).join('&');
  return `mailto:${e.to.trim()}${q ? `?${q}` : ''}`;
}

export const phonePayload = (n: string) => `tel:${n.replace(/[^\d+*#]/g, '')}`;
export const smsPayload = (s: SmsData) => `SMSTO:${s.number.replace(/[^\d+]/g, '')}:${s.message}`;

/* ------------------------------------------------------------------ */
/* Reading                                                             */
/* ------------------------------------------------------------------ */

export type Parsed =
  | { kind: 'url'; url: string }
  | { kind: 'wifi'; wifi: WifiData }
  | { kind: 'contact'; name: string; phone?: string; email?: string }
  | { kind: 'email'; to: string; subject?: string; body?: string }
  | { kind: 'phone'; number: string }
  | { kind: 'sms'; number: string; message: string }
  | { kind: 'text' };

/** Splits "a;b\;c" on unescaped separators and removes the escapes */
function splitEscaped(s: string, sep: string): string[] {
  const out: string[] = [];
  let cur = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '\\' && i + 1 < s.length) cur += s[++i];
    else if (ch === sep) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

export function parsePayload(text: string): Parsed {
  const t = text.trim();
  if (/^https?:\/\/\S+$/i.test(t)) return { kind: 'url', url: t };
  if (/^WIFI:/i.test(t)) {
    const fields = Object.fromEntries(
      splitEscaped(t.slice(5), ';')
        .filter((f) => f.includes(':'))
        .map((f) => [f.slice(0, f.indexOf(':')).toUpperCase(), f.slice(f.indexOf(':') + 1)]),
    );
    const sec = (fields.T ?? '').toUpperCase();
    return {
      kind: 'wifi',
      wifi: { ssid: fields.S ?? '', password: fields.P ?? '', security: sec === 'WEP' ? 'WEP' : sec === 'NOPASS' || !sec ? 'nopass' : 'WPA', hidden: (fields.H ?? '').toLowerCase() === 'true' },
    };
  }
  if (/^BEGIN:VCARD/i.test(t)) {
    const get = (key: string) => t.match(new RegExp(`^${key}(?:;[^:\\r\\n]*)?:(.*)$`, 'im'))?.[1]?.replace(/\\([,;\\])/g, '$1').trim();
    return { kind: 'contact', name: get('FN') ?? get('N')?.split(';').filter(Boolean).join(' ') ?? '', phone: get('TEL'), email: get('EMAIL') };
  }
  if (/^mailto:/i.test(t)) {
    const [addr, query = ''] = t.slice(7).split('?');
    const params = new URLSearchParams(query);
    return { kind: 'email', to: decodeURIComponent(addr), subject: params.get('subject') ?? undefined, body: params.get('body') ?? undefined };
  }
  if (/^tel:/i.test(t)) return { kind: 'phone', number: t.slice(4) };
  if (/^SMSTO:/i.test(t)) {
    const rest = t.slice(6);
    const i = rest.indexOf(':');
    return { kind: 'sms', number: i < 0 ? rest : rest.slice(0, i), message: i < 0 ? '' : rest.slice(i + 1) };
  }
  return { kind: 'text' };
}

/** Relative luminance contrast between two #rrggbb colors (WCAG formula) */
export function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
