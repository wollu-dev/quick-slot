import { useState, type ReactNode } from 'react';
import DateTimePicker from '../../components/ui/DateTimePicker';
import NumberField from '../../components/ui/NumberField';
import Segmented from '../../components/ui/Segmented';
import { LANG_TAGS, useLang, useT, withI18n } from '../../i18n';
import {
  addBusinessDays,
  addDays,
  addMonths,
  ageOn,
  businessDaysBetween,
  daysBetween,
  diffYmd,
  formatYmd,
  nextBirthday,
  parseYmd,
  toLocalDate,
  todayYmd,
  type Ymd,
} from '../../lib/dateCalc';

type Mode = 'between' | 'age' | 'add';
type Unit = 'day' | 'week' | 'month' | 'year' | 'businessDay';

function DateCalculator() {
  const t = useT();
  const c = t.dateCalc;
  const lang = useLang();
  const tag = LANG_TAGS[lang];
  const today = todayYmd();
  const todayStr = formatYmd(today);

  const [mode, setMode] = useState<Mode>('between');
  const [start, setStart] = useState(todayStr);
  const [end, setEnd] = useState(() => formatYmd(addDays(today, 100)));
  const [includeStart, setIncludeStart] = useState(false);
  const [birth, setBirth] = useState('2000-01-01');
  const [on, setOn] = useState(todayStr);
  const [base, setBase] = useState(todayStr);
  const [amount, setAmount] = useState(100);
  const [unit, setUnit] = useState<Unit>('day');
  const [dir, setDir] = useState<'after' | 'before'>('after');

  const num = (n: number) => n.toLocaleString(tag);
  const fullDate = (v: Ymd) => toLocalDate(v).toLocaleDateString(tag, { dateStyle: 'full' });
  /** D-day label relative to today: D-30, D-Day, D+5 */
  const dday = (v: Ymd) => {
    const n = daysBetween(today, v);
    return n === 0 ? 'D-Day' : n > 0 ? `D-${num(n)}` : `D+${num(-n)}`;
  };

  return (
    <div className="space-y-4">
      <Segmented
        label={c.mode}
        value={mode}
        onChange={setMode}
        options={[
          ['between', c.modes.between],
          ['age', c.modes.age],
          ['add', c.modes.add],
        ]}
      />

      {mode === 'between' &&
        (() => {
          const a = parseYmd(start) ?? today;
          const b = parseYmd(end) ?? today;
          const raw = daysBetween(a, b);
          const reversed = raw < 0;
          const [from, to] = reversed ? [b, a] : [a, b];
          const days = Math.abs(raw) + (includeStart ? 1 : 0);
          const span = diffYmd(from, includeStart ? addDays(to, 1) : to);
          const weekdays = Math.abs(businessDaysBetween(from, to)) + (includeStart && ![0, 6].includes(toLocalDate(from).getDay()) ? 1 : 0);
          return (
            <Layout
              inputs={
                <>
                  <Field label={c.start} id="dc-start">
                    <DateTimePicker id="dc-start" time={false} value={start} onChange={setStart} />
                  </Field>
                  <Field label={c.end} id="dc-end">
                    <DateTimePicker id="dc-end" time={false} value={end} onChange={setEnd} />
                  </Field>
                  <label className="flex items-start gap-2 text-sm">
                    <input type="checkbox" checked={includeStart} onChange={(e) => setIncludeStart(e.target.checked)} />
                    <span>
                      {c.includeStart}
                      <span className="mt-0.5 block text-xs text-muted">{c.includeStartNote}</span>
                    </span>
                  </label>
                </>
              }
              hero={c.days(num(days))}
              heroNote={reversed ? c.reversed : c.endIs(dday(b))}
              rows={[
                [c.inWeeks, c.weeksDays(num(Math.floor(days / 7)), num(days % 7))],
                [c.inMonths, c.ymd(num(span.years), num(span.months), num(span.days))],
                [c.weekdays, c.days(num(weekdays))],
                [c.weekends, c.days(num(days - weekdays))],
                [c.hours, c.hoursValue(num(days * 24))],
              ]}
            />
          );
        })()}

      {mode === 'age' &&
        (() => {
          const b = parseYmd(birth) ?? today;
          const o = parseYmd(on) ?? today;
          const valid = daysBetween(b, o) >= 0;
          const next = nextBirthday(b, o);
          const untilNext = daysBetween(o, next);
          return (
            <Layout
              inputs={
                <>
                  <Field label={c.birth} id="dc-birth">
                    <DateTimePicker id="dc-birth" time={false} value={birth} onChange={setBirth} />
                  </Field>
                  <Field label={c.on} id="dc-on">
                    <DateTimePicker id="dc-on" time={false} value={on} onChange={setOn} />
                  </Field>
                </>
              }
              hero={valid ? c.age(num(ageOn(b, o))) : '-'}
              heroNote={valid ? c.ageNote : c.birthAfter}
              rows={
                valid
                  ? [
                      ...(lang === 'ko' ? ([[c.yearAgeLabel, c.age(num(o.y - b.y))]] as [string, string][]) : []),
                      [c.nextBirthday, `${fullDate(next)} · ${untilNext === 0 ? c.todayBirthday : c.daysLeft(num(untilNext))}`],
                      [c.daysLived, c.days(num(daysBetween(b, o)))],
                      [c.bornOn, fullDate(b)],
                    ]
                  : []
              }
            />
          );
        })()}

      {mode === 'add' &&
        (() => {
          const b = parseYmd(base) ?? today;
          const n = dir === 'after' ? amount : -amount;
          const result =
            unit === 'day' ? addDays(b, n) : unit === 'week' ? addDays(b, n * 7) : unit === 'month' ? addMonths(b, n) : unit === 'year' ? addMonths(b, n * 12) : addBusinessDays(b, n);
          return (
            <Layout
              inputs={
                <>
                  <Field label={c.base} id="dc-base">
                    <DateTimePicker id="dc-base" time={false} value={base} onChange={setBase} />
                  </Field>
                  <Field label={c.amount} id="dc-amount">
                    <NumberField id="dc-amount" min={0} max={100000} value={amount} onChange={setAmount} />
                  </Field>
                  <div>
                    <span className="label">{c.unit}</span>
                    <div className="no-scrollbar -mx-1 overflow-x-auto px-1">
                      <Segmented
                        label={c.unit}
                        value={unit}
                        onChange={setUnit}
                        options={[
                          ['day', c.units.day],
                          ['week', c.units.week],
                          ['month', c.units.month],
                          ['year', c.units.year],
                          ['businessDay', c.units.businessDay],
                        ]}
                      />
                    </div>
                  </div>
                  <Segmented
                    label={c.direction}
                    value={dir}
                    onChange={setDir}
                    options={[
                      ['after', c.after],
                      ['before', c.before],
                    ]}
                  />
                </>
              }
              hero={fullDate(result)}
              heroNote={`${dday(result)} · ${c.fromToday}`}
              rows={[[c.resultIso, formatYmd(result)]]}
            />
          );
        })()}
    </div>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: ReactNode }) {
  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      {children}
    </div>
  );
}

/** Inputs on the left, the main result large on the right with detail rows below */
function Layout({ inputs, hero, heroNote, rows }: { inputs: ReactNode; hero: string; heroNote: string; rows: [string, string][] }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="panel space-y-4 self-start p-4">{inputs}</aside>
      <section className="min-w-0 space-y-3">
        <div className="panel p-5">
          <p className="text-[28px] leading-tight font-bold tracking-tight tabular-nums sm:text-[34px]" aria-live="polite">
            {hero}
          </p>
          <p className="mt-1 text-[14px] text-muted">{heroNote}</p>
        </div>
        {rows.length > 0 && (
          <dl className="panel divide-y divide-line px-4">
            {rows.map(([k, v]) => (
              <div key={k} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-3">
                <dt className="text-[13px] text-muted">{k}</dt>
                <dd className="text-[15px] font-medium tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>
    </div>
  );
}

export default withI18n(DateCalculator);
