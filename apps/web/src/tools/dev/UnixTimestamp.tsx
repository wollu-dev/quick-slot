import { useEffect, useMemo, useState } from 'react';
import CopyButton from '../../components/ui/CopyButton';

const pad = (n: number) => String(n).padStart(2, '0');
const toLocalInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

const rtf = new Intl.RelativeTimeFormat('ko', { numeric: 'auto' });
function relative(d: Date): string {
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

export default function UnixTimestamp() {
  const [now, setNow] = useState(() => Date.now());
  const [ts, setTs] = useState('');
  const [dateInput, setDateInput] = useState('');

  useEffect(() => {
    setTs(String(Math.floor(Date.now() / 1000)));
    setDateInput(toLocalInput(new Date()));
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const parsed = useMemo(() => {
    const s = ts.trim();
    if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
    const n = Number(s);
    // 자릿수로 단위 추정: 13자리 이상 = 밀리초, 16자리 이상 = 마이크로초
    const digits = s.replace(/^-/, '').split('.')[0].length;
    const unit = digits >= 16 ? 'µs' : digits >= 12 ? 'ms' : 's';
    const ms = unit === 's' ? n * 1000 : unit === 'ms' ? n : n / 1000;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : { d, unit };
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
          <div className="text-xs text-muted">지금</div>
          <div className="font-mono text-2xl font-semibold tabular-nums text-accent">{Math.floor(now / 1000)}</div>
        </div>
        <div className="font-mono text-sm text-muted tabular-nums">{now} ms</div>
        <CopyButton text={String(Math.floor(now / 1000))} className="ml-auto" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="panel p-4">
          <h2 className="mb-3 text-sm font-semibold">타임스탬프 → 날짜</h2>
          <input className="input font-mono" value={ts} onChange={(e) => setTs(e.target.value)} placeholder="예: 1700000000" />
          {parsed ? (
            <div className="mt-3">
              <p className="mb-1 text-xs text-muted">단위: {parsed.unit === 's' ? '초' : parsed.unit === 'ms' ? '밀리초' : '마이크로초'} (자동 감지)</p>
              <Row label={`현지 (${tz})`} value={parsed.d.toLocaleString('ko-KR', { dateStyle: 'full', timeStyle: 'medium' })} />
              <Row label="UTC" value={parsed.d.toUTCString()} />
              <Row label="ISO 8601" value={parsed.d.toISOString()} />
              <Row label="상대 시간" value={relative(parsed.d)} />
            </div>
          ) : (
            ts && <p className="mt-2 text-sm text-danger">숫자만 입력하세요</p>
          )}
        </section>

        <section className="panel p-4">
          <h2 className="mb-3 text-sm font-semibold">날짜 → 타임스탬프</h2>
          <input type="datetime-local" step={1} className="input" value={dateInput} onChange={(e) => setDateInput(e.target.value)} />
          {fromDate && (
            <div className="mt-3">
              <p className="mb-1 text-xs text-muted">입력한 시각은 {tz} 기준이에요</p>
              <Row label="초 (s)" value={String(Math.floor(fromDate.getTime() / 1000))} />
              <Row label="밀리초 (ms)" value={String(fromDate.getTime())} />
              <Row label="ISO 8601" value={fromDate.toISOString()} />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
