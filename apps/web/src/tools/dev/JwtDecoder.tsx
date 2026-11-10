import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, Info, XCircle } from 'lucide-react';
import CopyButton from '../../components/ui/CopyButton';
import TextPanel from '../../components/ui/TextPanel';
import { LANG_TAGS, useLang, useT, withI18n } from '../../i18n';
import Rich from '../../i18n/Rich';
import { base64UrlEncode, claimDate, decodeJwt, JwtError, jwtStatus, type JwtStatus } from '../../lib/jwt';
import { relativeTime } from '../../lib/time';

/** Registered claims shown in the summary, in this order */
const CLAIMS = ['iss', 'sub', 'aud', 'exp', 'nbf', 'iat', 'jti'] as const;
const TIME_CLAIMS = new Set(['exp', 'nbf', 'iat']);

/** A token that expires an hour from now, so the example shows a live countdown */
function sampleToken(): string {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = { sub: '1234567890', name: 'QuickSlot', role: 'admin', iat: now, exp: now + 3600 };
  return `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(payload))}.dGhpcy1pcy1hLXNhbXBsZS1zaWduYXR1cmU`;
}

const STATUS_STYLE: Record<JwtStatus, { icon: typeof CheckCircle2; className: string }> = {
  valid: { icon: CheckCircle2, className: 'bg-ok/12 text-ok' },
  expired: { icon: XCircle, className: 'bg-danger/12 text-danger' },
  notYet: { icon: Clock, className: 'bg-accent/12 text-accent' },
  noExpiry: { icon: Info, className: 'bg-panel-2 text-muted' },
};

function JwtDecoder() {
  const t = useT();
  const j = t.jwt;
  const lang = useLang();
  const [input, setInput] = useState('');
  const [now, setNow] = useState(() => Date.now());

  // Keep "expires in …" current
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const result = useMemo(() => {
    if (!input.trim()) return null;
    try {
      return { jwt: decodeJwt(input) };
    } catch (e) {
      return { error: e instanceof JwtError ? e : new JwtError('parts') };
    }
  }, [input]);

  const fmtDate = (d: Date) => d.toLocaleString(LANG_TAGS[lang], { dateStyle: 'medium', timeStyle: 'medium' });
  const jwt = result && 'jwt' in result ? result.jwt : null;
  const error = result && 'error' in result ? result.error : null;
  const headerJson = jwt ? JSON.stringify(jwt.header, null, 2) : '';
  const payloadJson = jwt ? JSON.stringify(jwt.payload, null, 2) : '';
  const status = jwt ? jwtStatus(jwt.payload, now) : null;
  const alg = jwt && typeof jwt.header.alg === 'string' ? jwt.header.alg : null;

  const statusText = (s: JwtStatus) => {
    const exp = claimDate(jwt?.payload.exp);
    const nbf = claimDate(jwt?.payload.nbf);
    if (s === 'valid' && exp) return j.status.valid(relativeTime(exp, lang, now));
    if (s === 'expired' && exp) return j.status.expired(relativeTime(exp, lang, now));
    if (s === 'notYet' && nbf) return j.status.notYet(relativeTime(nbf, lang, now));
    return j.status.noExpiry;
  };

  const claimValue = (key: string, v: unknown) => {
    const d = TIME_CLAIMS.has(key) ? claimDate(v) : null;
    if (d) return `${fmtDate(d)} (${relativeTime(d, lang, now)})`;
    return typeof v === 'string' ? v : JSON.stringify(v);
  };

  return (
    <div className="space-y-3">
      <TextPanel
        label={j.token}
        value={input}
        onChange={setInput}
        placeholder={j.placeholder}
        minHeight="min-h-[18vh]"
        actions={
          <button type="button" className="btn" onClick={() => setInput(sampleToken())}>
            {j.sample}
          </button>
        }
      />

      {error && (
        <p className="flex items-start gap-2 rounded-2xl bg-danger/10 p-3 text-sm text-danger" role="alert">
          <XCircle size={16} className="mt-0.5 shrink-0" />
          {error.code === 'parts' || error.code === 'encrypted' ? j.errors[error.code] : j.errors[error.code](error.part === 'header' ? j.header : j.payload)}
        </p>
      )}

      {jwt && status && (
        <>
          <div className="panel flex flex-wrap items-center gap-2 p-3">
            {(() => {
              const { icon: Icon, className } = STATUS_STYLE[status];
              return (
                <span className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium ${className}`}>
                  <Icon size={15} strokeWidth={2.4} />
                  {statusText(status)}
                </span>
              );
            })()}
            {alg && (
              <span className="inline-flex h-9 items-center rounded-full bg-panel-2 px-3.5 font-mono text-[13px]">
                alg: {alg}
              </span>
            )}
            {alg?.toLowerCase() === 'none' && (
              <span className="inline-flex items-center gap-1.5 text-[13px] text-danger">
                <AlertTriangle size={15} strokeWidth={2.4} />
                {j.algNone}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <TextPanel label={j.header} value={headerJson} actions={<CopyButton text={headerJson} />} minHeight="min-h-64" />
            <TextPanel label={j.payload} value={payloadJson} actions={<CopyButton text={payloadJson} />} minHeight="min-h-64" />
          </div>

          {CLAIMS.some((k) => k in jwt.payload) && (
            <section className="panel p-4" aria-label={j.claims}>
              <h3 className="mb-1 text-[13px] font-medium text-muted">{j.claims}</h3>
              <dl className="divide-y divide-line">
                {CLAIMS.filter((k) => k in jwt.payload).map((k) => (
                  <div key={k} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-2">
                    <dt className="w-40 shrink-0 text-[13px] text-muted">
                      {j.claim[k]} <span className="font-mono text-[12px]">({k})</span>
                    </dt>
                    <dd className="min-w-0 flex-1 font-mono text-[13px] break-all">{claimValue(k, jwt.payload[k])}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          <div className="panel p-4">
            <h3 className="mb-1 text-[13px] font-medium text-muted">{j.signature}</h3>
            <p className="font-mono text-[13px] break-all text-muted">{jwt.signature || '-'}</p>
          </div>
        </>
      )}

      <p className="flex items-start gap-2 px-1 text-[13px] text-muted">
        <Info size={15} className="mt-0.5 shrink-0" />
        <span>
          <Rich text={j.note} />
        </span>
      </p>
    </div>
  );
}

export default withI18n(JwtDecoder);
