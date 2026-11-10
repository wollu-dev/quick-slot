import { useState } from 'react';
import CopyButton from '../../components/ui/CopyButton';
import NumberField from '../../components/ui/NumberField';
import Segmented from '../../components/ui/Segmented';
import Select from '../../components/ui/Select';
import { LANG_TAGS, useLang, useT, withI18n, type Lang } from '../../i18n';
import { fromMinor, MINOR_DIGITS, ROUNDING_STEPS, split, toMinor, type Currency, type RoundMode } from '../../lib/dutchPay';
import { parseNumber } from '../../lib/units';

const DEFAULT_CURRENCY: Record<Lang, Currency> = { ko: 'KRW', ja: 'JPY', en: 'USD' };
const MAX_PEOPLE = 50;

/** Text field for an amount of money (decimals allowed for currencies that have them) */
function MoneyField({ id, value, onChange, placeholder, allowNegative }: { id?: string; value: string; onChange: (v: string) => void; placeholder?: string; allowNegative?: boolean }) {
  const invalid = value.trim() !== '' && (parseNumber(value) === null || (!allowNegative && (parseNumber(value) ?? 0) < 0));
  return (
    <input
      id={id}
      className="input text-right font-mono tabular-nums"
      inputMode="decimal"
      autoComplete="off"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-invalid={invalid}
    />
  );
}

function DutchPay() {
  const t = useT();
  const d = t.dutchPay;
  const lang = useLang();
  const [currency, setCurrency] = useState<Currency>(DEFAULT_CURRENCY[lang]);
  const [total, setTotal] = useState('');
  const [count, setCount] = useState(4);
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState<RoundMode>('up');
  const [names, setNames] = useState<string[]>([]);
  const [extras, setExtras] = useState<string[]>([]);

  const money = (minor: number) =>
    new Intl.NumberFormat(LANG_TAGS[lang], { style: 'currency', currency, minimumFractionDigits: MINOR_DIGITS[currency], maximumFractionDigits: MINOR_DIGITS[currency] }).format(fromMinor(minor, currency));

  const people = Array.from({ length: count }, (_, i) => ({
    name: names[i]?.trim() || d.person(i + 1),
    extra: toMinor(parseNumber(extras[i] ?? '') ?? 0, currency),
  }));
  const totalNum = parseNumber(total);
  const totalMinor = totalNum !== null && totalNum > 0 ? toMinor(totalNum, currency) : null;
  const result = totalMinor === null ? null : split(totalMinor, people.map((p) => p.extra), step, mode);
  const steps = ROUNDING_STEPS[currency];

  const setAt = (arr: string[], set: (v: string[]) => void, i: number, v: string) => {
    const next = [...arr];
    next[i] = v;
    set(next);
  };

  const summary = result
    ? [d.summaryTitle(money(totalMinor!), count), ...people.map((p, i) => `- ${p.name}${i === 0 ? ` (${d.organizer})` : ''}: ${money(result.shares[i])}`)].join('\n')
    : '';

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
      <aside className="panel space-y-4 self-start p-4">
        <div>
          <label className="label" htmlFor="dp-total">
            {d.total}
          </label>
          <MoneyField id="dp-total" value={total} onChange={setTotal} placeholder="0" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="dp-count">
              {d.people}
            </label>
            <NumberField id="dp-count" min={1} max={MAX_PEOPLE} value={count} onChange={setCount} />
          </div>
          <div>
            <label className="label" htmlFor="dp-currency">
              {d.currency}
            </label>
            <Select
              id="dp-currency"
              value={currency}
              onChange={(c) => {
                setCurrency(c);
                setStep(1);
              }}
              options={(['KRW', 'JPY', 'USD', 'EUR'] as const).map((c) => [c, c] as const)}
            />
          </div>
        </div>
        <div>
          <span className="label">{d.rounding}</span>
          <Segmented label={d.rounding} value={String(step)} onChange={(v) => setStep(Number(v))} options={steps.map((s) => [String(s), money(s)] as const)} />
        </div>
        {step > 1 && (
          <div>
            <Segmented
              label={d.roundMode}
              value={mode}
              onChange={setMode}
              options={[
                ['up', d.up],
                ['down', d.down],
              ]}
            />
            <p className="mt-1.5 text-xs text-muted">{mode === 'up' ? d.upNote : d.downNote}</p>
          </div>
        )}
      </aside>

      <section className="min-w-0 space-y-3">
        <div className="panel p-5">
          <p className="text-[13px] text-muted">{d.perPerson}</p>
          <p className="text-[28px] leading-tight font-bold tracking-tight tabular-nums sm:text-[34px]" aria-live="polite">
            {result ? money(result.perPerson) : '-'}
          </p>
          <p className="mt-1 text-[13px] text-muted">
            {totalMinor === null ? d.enterTotal : !result ? d.extrasTooLarge : result.organizerAdjust !== 0 && count > 1 ? d.organizerNote(money(Math.abs(Math.round(result.organizerAdjust))), result.organizerAdjust > 0) : d.exact}
          </p>
        </div>

        <div className="panel overflow-hidden">
          <div className="grid grid-cols-[minmax(0,1fr)_7.5rem_auto] items-center gap-2 border-b border-line px-4 py-2 text-[12px] font-medium text-muted sm:grid-cols-[minmax(0,1fr)_9rem_8rem]">
            <span>{d.name}</span>
            <span className="text-right">{d.extra}</span>
            <span className="text-right">{d.pays}</span>
          </div>
          <ul className="divide-y divide-line">
            {people.map((p, i) => (
              <li key={i} className="grid grid-cols-[minmax(0,1fr)_7.5rem_auto] items-center gap-2 px-4 py-2 sm:grid-cols-[minmax(0,1fr)_9rem_8rem]">
                <div className="flex min-w-0 items-center gap-2">
                  <input className="input min-w-0" aria-label={d.name} placeholder={d.person(i + 1)} value={names[i] ?? ''} onChange={(e) => setAt(names, setNames, i, e.target.value)} />
                  {i === 0 && count > 1 && <span className="hidden shrink-0 rounded-full bg-accent/12 px-2 py-0.5 text-[11px] font-medium text-accent sm:inline">{d.organizer}</span>}
                </div>
                <MoneyField value={extras[i] ?? ''} onChange={(v) => setAt(extras, setExtras, i, v)} placeholder="0" allowNegative />
                <span className="text-right font-mono text-[14px] font-semibold tabular-nums">{result ? money(result.shares[i]) : '-'}</span>
              </li>
            ))}
          </ul>
          <p className="border-t border-line px-4 py-2 text-xs text-muted">{d.extraHint}</p>
        </div>

        {result && (
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <p className="text-[13px] text-muted">{d.check(money(result.shares.reduce((a, b) => a + b, 0)))}</p>
            <CopyButton text={summary} label={d.copySummary} />
          </div>
        )}
      </section>
    </div>
  );
}

export default withI18n(DutchPay);
