import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Camera, CameraOff, ClipboardCopy, Download, ExternalLink } from 'lucide-react';
import QRCode from 'qrcode';
import CopyButton from '../../components/ui/CopyButton';
import DropZone from '../../components/ui/DropZone';
import NumberField from '../../components/ui/NumberField';
import Segmented from '../../components/ui/Segmented';
import Select from '../../components/ui/Select';
import TextPanel from '../../components/ui/TextPanel';
import { useT, withI18n } from '../../i18n';
import Rich from '../../i18n/Rich';
import { downloadBlob } from '../../lib/files';
import {
  contactPayload,
  contrast,
  emailPayload,
  parsePayload,
  phonePayload,
  smsPayload,
  wifiPayload,
  type ContactData,
  type EmailData,
  type Parsed,
  type QrKind,
  type SmsData,
  type WifiData,
} from '../../lib/qr';

type Mode = 'make' | 'read';
type Level = 'L' | 'M' | 'Q' | 'H';

function QrTool() {
  const t = useT();
  const [mode, setMode] = useState<Mode>('make');
  return (
    <div className="space-y-4">
      <Segmented
        label={t.qr.mode}
        value={mode}
        onChange={setMode}
        options={[
          ['make', t.qr.make],
          ['read', t.qr.read],
        ]}
      />
      {/* Both stay mounted so switching back and forth keeps what was entered */}
      <div hidden={mode !== 'make'} data-tab="make">
        <Make />
      </div>
      <div hidden={mode !== 'read'} data-tab="read">
        <Read active={mode === 'read'} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Make                                                                */
/* ------------------------------------------------------------------ */

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="label" htmlFor={id}>
        {label}
      </label>
      {children}
    </div>
  );
}

function Make() {
  const t = useT();
  const q = t.qr;
  const [kind, setKind] = useState<QrKind>('text');
  const [text, setText] = useState('');
  const [wifi, setWifi] = useState<WifiData>({ ssid: '', password: '', security: 'WPA', hidden: false });
  const [contact, setContact] = useState<ContactData>({ name: '', org: '', phone: '', email: '', url: '' });
  const [email, setEmail] = useState<EmailData>({ to: '', subject: '', body: '' });
  const [phone, setPhone] = useState('');
  const [sms, setSms] = useState<SmsData>({ number: '', message: '' });
  const [level, setLevel] = useState<Level>('M');
  const [size, setSize] = useState(1024);
  const [margin, setMargin] = useState(4);
  const [dark, setDark] = useState('#000000');
  const [light, setLight] = useState('#ffffff');
  const [transparent, setTransparent] = useState(false);
  const [svg, setSvg] = useState('');
  const [error, setError] = useState<'tooLong' | null>(null);
  const [copied, setCopied] = useState<'ok' | 'fail' | null>(null);

  const payload =
    kind === 'text'
      ? text
      : kind === 'wifi'
        ? wifi.ssid && wifiPayload(wifi)
        : kind === 'contact'
          ? (contact.name || contact.phone || contact.email) && contactPayload(contact)
          : kind === 'email'
            ? email.to && emailPayload(email)
            : kind === 'phone'
              ? phone.trim() && phonePayload(phone)
              : sms.number.trim() && smsPayload(sms);

  const lightColor = transparent ? '#ffffff00' : light;
  const options = { errorCorrectionLevel: level, margin, color: { dark, light: lightColor } };
  const low = contrast(dark, transparent ? '#ffffff' : light) < 3;
  const inverted = !transparent && contrast(dark, '#000000') > contrast(light, '#000000');

  useEffect(() => {
    if (!payload) {
      setSvg('');
      setError(null);
      return;
    }
    let cancelled = false;
    QRCode.toString(payload, { ...options, type: 'svg' })
      .then((s) => {
        if (cancelled) return;
        setSvg(s);
        setError(null);
      })
      .catch(() => {
        if (cancelled) return;
        setSvg('');
        setError('tooLong');
      });
    return () => {
      cancelled = true;
    };
  }, [payload, level, margin, dark, lightColor]);

  const png = async () => {
    const canvas = document.createElement('canvas');
    await QRCode.toCanvas(canvas, payload as string, { ...options, width: size });
    return new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('png'))), 'image/png'));
  };
  const copyPng = async () => {
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': png() })]);
      setCopied('ok');
    } catch {
      setCopied('fail');
    }
    setTimeout(() => setCopied(null), 1500);
  };

  const input = (id: string, value: string, onChange: (v: string) => void, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <input id={id} className="input w-full" value={value} onChange={(e) => onChange(e.target.value)} {...extra} />
  );

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section className="min-w-0 space-y-4">
        <div className="panel space-y-4 p-4">
          <Field id="qr-kind" label={q.kind}>
            <Select
              id="qr-kind"
              value={kind}
              onChange={setKind}
              options={[
                ['text', q.kinds.text],
                ['wifi', q.kinds.wifi],
                ['contact', q.kinds.contact],
                ['email', q.kinds.email],
                ['phone', q.kinds.phone],
                ['sms', q.kinds.sms],
              ]}
            />
          </Field>

          {kind === 'text' && <TextPanel label={q.content} value={text} onChange={setText} placeholder={q.textPlaceholder} minHeight="min-h-36" />}

          {kind === 'wifi' && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field id="qr-ssid" label={q.wifi.ssid}>
                {input('qr-ssid', wifi.ssid, (ssid) => setWifi({ ...wifi, ssid }), { autoComplete: 'off', spellCheck: false })}
              </Field>
              <Field id="qr-sec" label={q.wifi.security}>
                <Select
                  id="qr-sec"
                  value={wifi.security}
                  onChange={(security) => setWifi({ ...wifi, security })}
                  options={[
                    ['WPA', 'WPA / WPA2 / WPA3'],
                    ['WEP', 'WEP'],
                    ['nopass', q.wifi.open],
                  ]}
                />
              </Field>
              {wifi.security !== 'nopass' && (
                <Field id="qr-pass" label={q.wifi.password}>
                  {input('qr-pass', wifi.password, (password) => setWifi({ ...wifi, password }), { autoComplete: 'off', spellCheck: false })}
                </Field>
              )}
              <label className="flex items-center gap-2 self-end pb-2 text-sm">
                <input type="checkbox" checked={wifi.hidden} onChange={(e) => setWifi({ ...wifi, hidden: e.target.checked })} />
                {q.wifi.hidden}
              </label>
              <p className="text-xs text-muted sm:col-span-2">{q.wifi.note}</p>
            </div>
          )}

          {kind === 'contact' && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field id="qr-name" label={q.contact.name}>
                {input('qr-name', contact.name, (name) => setContact({ ...contact, name }), { autoComplete: 'name' })}
              </Field>
              <Field id="qr-org" label={q.contact.org}>
                {input('qr-org', contact.org, (org) => setContact({ ...contact, org }), { autoComplete: 'organization' })}
              </Field>
              <Field id="qr-tel" label={q.contact.phone}>
                {input('qr-tel', contact.phone, (p) => setContact({ ...contact, phone: p }), { type: 'tel', autoComplete: 'tel' })}
              </Field>
              <Field id="qr-mail" label={q.contact.email}>
                {input('qr-mail', contact.email, (m) => setContact({ ...contact, email: m }), { type: 'email', autoComplete: 'email' })}
              </Field>
              <div className="sm:col-span-2">
                <Field id="qr-url" label={q.contact.url}>
                  {input('qr-url', contact.url, (url) => setContact({ ...contact, url }), { type: 'url', placeholder: 'https://' })}
                </Field>
              </div>
            </div>
          )}

          {kind === 'email' && (
            <div className="space-y-3">
              <Field id="qr-to" label={q.email.to}>
                {input('qr-to', email.to, (to) => setEmail({ ...email, to }), { type: 'email' })}
              </Field>
              <Field id="qr-subject" label={q.email.subject}>
                {input('qr-subject', email.subject, (subject) => setEmail({ ...email, subject }))}
              </Field>
              <TextPanel label={q.email.body} value={email.body} onChange={(body) => setEmail({ ...email, body })} minHeight="min-h-28" />
            </div>
          )}

          {kind === 'phone' && (
            <Field id="qr-phone" label={q.contact.phone}>
              {input('qr-phone', phone, setPhone, { type: 'tel', placeholder: '010-1234-5678' })}
            </Field>
          )}

          {kind === 'sms' && (
            <div className="space-y-3">
              <Field id="qr-smsto" label={q.contact.phone}>
                {input('qr-smsto', sms.number, (number) => setSms({ ...sms, number }), { type: 'tel', placeholder: '010-1234-5678' })}
              </Field>
              <TextPanel label={q.sms.message} value={sms.message} onChange={(message) => setSms({ ...sms, message })} minHeight="min-h-28" />
            </div>
          )}
        </div>

        <div className="panel grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">
          <Field id="qr-level" label={q.level}>
            <Select
              id="qr-level"
              value={level}
              onChange={setLevel}
              options={[
                ['L', q.levels.L],
                ['M', q.levels.M],
                ['Q', q.levels.Q],
                ['H', q.levels.H],
              ]}
            />
          </Field>
          <Field id="qr-size" label={q.size}>
            <div className="flex items-center gap-2">
              <NumberField id="qr-size" value={size} onChange={setSize} min={64} max={4096} step={64} className="min-w-0 flex-1" />
              <span className="text-sm text-muted">px</span>
            </div>
          </Field>
          <Field id="qr-margin" label={q.margin}>
            <NumberField id="qr-margin" value={margin} onChange={setMargin} min={0} max={20} />
          </Field>
          <div className="space-y-1.5">
            <span className="label block">{q.colors}</span>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="color" className="size-9 cursor-pointer rounded-full border border-line bg-transparent p-0.5" value={dark} onChange={(e) => setDark(e.target.value)} aria-label={q.fg} />
                {q.fg}
              </label>
              <label className={`flex items-center gap-2 text-sm ${transparent ? 'opacity-40' : ''}`}>
                <input
                  type="color"
                  className="size-9 cursor-pointer rounded-full border border-line bg-transparent p-0.5"
                  value={light}
                  disabled={transparent}
                  onChange={(e) => setLight(e.target.value)}
                  aria-label={q.bg}
                />
                {q.bg}
              </label>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" checked={transparent} onChange={(e) => setTransparent(e.target.checked)} />
            {q.transparent}
          </label>
          {(low || inverted) && (
            <p className="flex items-start gap-1.5 text-sm text-danger sm:col-span-2">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              {low ? q.lowContrast : q.invertedNote}
            </p>
          )}
        </div>
      </section>

      <aside className="panel min-w-0 space-y-3 self-start p-4 lg:sticky lg:top-24">
        <div className="grid aspect-square place-items-center overflow-hidden rounded-2xl bg-[repeating-conic-gradient(var(--color-panel-2)_0_25%,transparent_0_50%)] bg-[length:16px_16px]">
          {svg ? (
            <div className="size-full [&>svg]:size-full" role="img" aria-label={q.preview} dangerouslySetInnerHTML={{ __html: svg }} />
          ) : (
            <p className="px-6 text-center text-sm text-muted">{error ? q.tooLong : q.empty}</p>
          )}
        </div>
        {svg && <p className="text-center text-xs text-muted">{q.scanHint}</p>}
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="btn btn-primary" disabled={!svg} onClick={async () => downloadBlob(await png(), 'qrcode.png')}>
            <Download size={15} strokeWidth={2.2} />
            PNG
          </button>
          <button type="button" className="btn" disabled={!svg} onClick={() => downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), 'qrcode.svg')}>
            <Download size={15} strokeWidth={2.2} />
            SVG
          </button>
        </div>
        <button type="button" className="btn w-full" disabled={!svg} onClick={copyPng}>
          <ClipboardCopy size={15} strokeWidth={2.2} />
          {copied === 'ok' ? t.common.copied : copied === 'fail' ? t.common.copyFailed : q.copyImage}
        </button>
      </aside>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Read                                                                */
/* ------------------------------------------------------------------ */

async function decodeFrom(source: CanvasImageSource, w: number, h: number): Promise<string | null> {
  const { default: jsQR } = await import('jsqr');
  // Try a couple of sizes: very large photos decode faster and often better when scaled down
  for (const max of [1600, 800]) {
    const s = Math.min(1, max / Math.max(w, h));
    const cw = Math.max(1, Math.round(w * s));
    const ch = Math.max(1, Math.round(h * s));
    const canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    // Transparent pixels would read as black and hide a dark code: put the image on white
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, cw, ch);
    ctx.drawImage(source, 0, 0, cw, ch);
    const found = jsQR(ctx.getImageData(0, 0, cw, ch).data, cw, ch, { inversionAttempts: 'attemptBoth' });
    if (found?.data) return found.data;
    if (s === 1) break;
  }
  return null;
}

function Read({ active }: { active: boolean }) {
  const t = useT();
  const q = t.qr;
  const [result, setResult] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'reading' | 'notFound' | 'badImage' | 'camera' | 'noCamera'>('idle');
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);

  const stopCamera = () => {
    stream.current?.getTracks().forEach((tr) => tr.stop());
    stream.current = null;
  };
  useEffect(() => stopCamera, []);
  // Leaving the Read tab turns the camera off
  useEffect(() => {
    if (!active && stream.current) {
      stopCamera();
      setStatus('idle');
    }
  }, [active]);

  const readFile = async (file: File) => {
    stopCamera();
    setStatus('reading');
    setResult(null);
    try {
      const bitmap = await createImageBitmap(file);
      const text = await decodeFrom(bitmap, bitmap.width, bitmap.height);
      bitmap.close();
      setResult(text);
      setStatus(text === null ? 'notFound' : 'idle');
    } catch {
      setStatus('badImage');
    }
  };

  // Paste an image (Ctrl+V / Cmd+V) anywhere on the page while this tab is open
  useEffect(() => {
    if (!active) return;
    const onPaste = (e: ClipboardEvent) => {
      const file = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith('image/'));
      if (file) {
        e.preventDefault();
        readFile(file);
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [active]);

  const startCamera = async () => {
    setResult(null);
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    } catch {
      setStatus('noCamera');
      return;
    }
    setStatus('camera');
  };

  // Scan frames while the camera is on
  useEffect(() => {
    if (status !== 'camera' || !video.current || !stream.current) return;
    const v = video.current;
    v.srcObject = stream.current;
    v.play().catch(() => {});
    let stop = false;
    const tick = async () => {
      if (stop) return;
      if (v.readyState >= 2 && v.videoWidth) {
        const text = await decodeFrom(v, v.videoWidth, v.videoHeight);
        if (text !== null && !stop) {
          setResult(text);
          setStatus('idle');
          stopCamera();
          return;
        }
      }
      setTimeout(tick, 250);
    };
    tick();
    return () => {
      stop = true;
    };
  }, [status]);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <section className="min-w-0 space-y-3">
        {status === 'camera' ? (
          <div className="panel overflow-hidden">
            <video ref={video} className="aspect-[4/3] w-full bg-panel-2 object-cover" muted playsInline />
            <div className="flex items-center justify-between gap-2 border-t border-line py-1.5 pr-1.5 pl-4">
              <span className="text-sm text-muted">{q.scanning}</span>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  stopCamera();
                  setStatus('idle');
                }}
              >
                <CameraOff size={15} strokeWidth={2.2} />
                {q.stopCamera}
              </button>
            </div>
          </div>
        ) : (
          <>
            <DropZone onFiles={(f) => readFile(f[0])} accept="image/*" multiple={false} hint={q.readHint} />
            <button type="button" className="btn w-full" onClick={startCamera}>
              <Camera size={15} strokeWidth={2.2} />
              {q.useCamera}
            </button>
          </>
        )}
        <p className="text-sm text-muted">
          <Rich text={q.readIntro} />
        </p>
      </section>

      <section className="min-w-0 space-y-3" aria-live="polite">
        {status === 'reading' && <p className="panel p-6 text-center text-sm text-muted">{q.reading}</p>}
        {(status === 'notFound' || status === 'badImage' || status === 'noCamera') && (
          <p className="panel flex items-start gap-2 p-4 text-sm text-danger">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            {q.errors[status]}
          </p>
        )}
        {result !== null && (
          <>
            <TextPanel label={q.result} value={result} actions={<CopyButton text={result} />} minHeight="min-h-28" />
            <ParsedCard parsed={parsePayload(result)} />
          </>
        )}
      </section>
    </div>
  );
}

function ParsedCard({ parsed }: { parsed: Parsed }) {
  const q = useT().qr;
  const rows: [string, string][] = [];
  let action: React.ReactNode = null;
  switch (parsed.kind) {
    case 'url': {
      let host = parsed.url;
      try {
        host = new URL(parsed.url).host;
      } catch {
        /* keep the raw text */
      }
      rows.push([q.site, host]);
      action = (
        <button type="button" className="btn btn-primary" onClick={() => window.open(parsed.url, '_blank', 'noopener,noreferrer')}>
          <ExternalLink size={15} strokeWidth={2.2} />
          {q.openLink}
        </button>
      );
      break;
    }
    case 'wifi':
      rows.push([q.wifi.ssid, parsed.wifi.ssid], [q.wifi.security, parsed.wifi.security === 'nopass' ? q.wifi.open : parsed.wifi.security]);
      if (parsed.wifi.password) rows.push([q.wifi.password, parsed.wifi.password]);
      break;
    case 'contact':
      rows.push([q.contact.name, parsed.name]);
      if (parsed.phone) rows.push([q.contact.phone, parsed.phone]);
      if (parsed.email) rows.push([q.contact.email, parsed.email]);
      break;
    case 'email':
      rows.push([q.email.to, parsed.to]);
      if (parsed.subject) rows.push([q.email.subject, parsed.subject]);
      break;
    case 'phone':
      rows.push([q.contact.phone, parsed.number]);
      break;
    case 'sms':
      rows.push([q.contact.phone, parsed.number]);
      if (parsed.message) rows.push([q.sms.message, parsed.message]);
      break;
    case 'text':
      return null;
  }
  return (
    <div className="panel space-y-3 p-4">
      <h3 className="text-sm font-medium">{q.detected[parsed.kind]}</h3>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted">{k}</dt>
            <dd className="font-medium break-all">{v}</dd>
            <CopyButton text={v} className="h-8 px-3 text-xs" />
          </div>
        ))}
      </dl>
      {parsed.kind === 'url' && <p className="text-xs text-muted">{q.linkWarning}</p>}
      {action}
    </div>
  );
}

export default withI18n(QrTool);
