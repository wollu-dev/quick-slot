import { useEffect, useMemo, useState } from 'react';
import CopyButton from '../../components/ui/CopyButton';
import { LANG_TAGS, useLang, useT, withI18n, type Lang } from '../../i18n';
import DateTimePicker, { toDateTimeValue } from '../../components/ui/DateTimePicker';

const pad = (n: number) => String(n).padStart(2, '0');
const toLocalInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

function relative(d: Date, lang: Lang): string {
  const rtf = new Intl.RelativeTimeFormat(LANG_TAGS[lang], { numeric: 'auto' });
  const diff = (d.getTime() - Date.now()) / 1000;
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31536000],
    ['month', 2592000],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
    ['second', 1],
  ];
  for (const [unit, sec] of units) if (Math.abs(diff) >= sec || unit === 'second') return rtf.format(Math.round(diff / sec), unit);
  return '';
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-line py-2 last:border-0">
      <span className="w-28 shrink-0 text-xs text-muted">{label}</span>
      <span className="min-w-0 flex-1 truncate font-mono text-sm">{value}</span>
      <CopyButton text={value} className="px-2 py-0.5 text-xs" />
    </div>
  );
}

function UnixTimestamp() {
  const t = useT();
  const s = t.timestamp;
  const lang = useLang();
  const [now, setNow] = useState(() => Date.now());
  const [ts, setTs] = useState('');
  const [dateInput, setDateInput] = useState(() => toDateTimeValue(new Date()));

  useEffect(() => {
    setTs(String(Math.floor(Date.now() / 1000)));
    setDateInput(toLocalInput(new Date()));
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const parsed = useMemo(() => {
    const v = ts.trim();
    if (!/^-?\d+(\.\d+)?$/.test(v)) return null;
    const n = Number(v);
    // Guess the unit from the digit count: 12+ digits = milliseconds, 16+ digits = microseconds
    const digits = v.replace(/^-/, '').split('.')[0].length;
    const unit = digits >= 16 ? 'us' : digits >= 12 ? 'ms' : 's';
    const ms = unit === 's' ? n * 1000 : unit === 'ms' ? n : n / 1000;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : { d, unit: unit as keyof typeof s.units };
  }, [ts]);

  const fromDate = useMemo(() => {
    const d = new Date(dateInput);
    return Number.isNaN(d.getTime()) ? null : d;
  }, [dateInput]);

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <div className="space-y-4">
      <div className="panel flex flex-wrap items-center gap-4 p-4">
        <div>
          <div className="text-xs text-muted">{s.now}</div>
          <div className="text-[34px] leading-tight font-semibold tracking-tight text-accent tabular-nums">{Math.floor(now / 1000)}</div>
        </div>
        <div className="font-mono text-sm text-muted tabular-nums">{now} ms</div>
        <CopyButton text={String(Math.floor(now / 1000))} className="ml-auto" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="panel p-4">
          <h2 className="mb-3 text-sm font-semibold">{s.tsToDate}</h2>
          <input className="input font-mono" value={ts} onChange={(e) => setTs(e.target.value)} placeholder={s.tsPlaceholder} />
          {parsed ? (
            <div className="mt-3">
              <p className="mb-1 text-xs text-muted">{s.unit(s.units[parsed.unit])}</p>
              <Row label={s.local(tz)} value={parsed.d.toLocaleString(LANG_TAGS[lang], { dateStyle: 'full', timeStyle: 'medium' })} />
              <Row label="UTC" value={parsed.d.toUTCString()} />
              <Row label="ISO 8601" value={parsed.d.toISOString()} />
              <Row label={s.relative} value={relative(parsed.d, lang)} />
            </div>
          ) : (
            ts && <p className="mt-2 text-sm text-danger">{s.numbersOnly}</p>
          )}
        </section>

        <section className="panel p-4">
          <h2 className="mb-3 text-sm font-semibold">{s.dateToTs}</h2>
          <DateTimePicker label={s.dateToTs} value={dateInput} onChange={setDateInput} />
          {fromDate && (
            <div className="mt-3">
              <p className="mb-1 text-xs text-muted">{s.tzNote(tz)}</p>
              <Row label={s.seconds} value={String(Math.floor(fromDate.getTime() / 1000))} />
              <Row label={s.millis} value={String(fromDate.getTime())} />
              <Row label="ISO 8601" value={fromDate.toISOString()} />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default withI18n(UnixTimestamp);
