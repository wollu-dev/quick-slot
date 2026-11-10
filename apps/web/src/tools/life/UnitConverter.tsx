import { useState } from 'react';
import CopyButton from '../../components/ui/CopyButton';
import Select from '../../components/ui/Select';
import { LANG_TAGS, useLang, useT, withI18n } from '../../i18n';
import { belowMinimum, CATEGORIES, clean, convert, getCategory, parseNumber, type CategoryId } from '../../lib/units';

function UnitConverter() {
  const t = useT();
  const c = t.unitConv;
  const lang = useLang();
  const [category, setCategory] = useState<CategoryId>('length');
  const [from, setFrom] = useState('m');
  const [input, setInput] = useState('1');

  const cat = getCategory(category);
  const fromUnit = cat.units.find((x) => x.id === from) ?? cat.units[0];
  const value = parseNumber(input);
  const invalid = input.trim() !== '' && value === null;
  const tooLow = value !== null && belowMinimum(category, value, fromUnit);

  const pick = (id: CategoryId) => {
    setCategory(id);
    setFrom(getCategory(id).defaultUnit);
    setInput('1');
  };

  const fmt = (n: number) => n.toLocaleString(LANG_TAGS[lang], { maximumSignificantDigits: 12 });

  return (
    <div className="space-y-4">
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0" role="radiogroup" aria-label={c.category}>
        {CATEGORIES.map((x) => (
          <button key={x.id} type="button" role="radio" aria-checked={x.id === category} aria-pressed={x.id === category} className="chip" onClick={() => pick(x.id)}>
            {c.categories[x.id]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="panel space-y-4 self-start p-4">
          <div>
            <label className="label" htmlFor="unit-value">
              {c.value}
            </label>
            <input
              id="unit-value"
              className="input font-mono tabular-nums"
              inputMode="decimal"
              autoComplete="off"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              aria-invalid={invalid || tooLow}
            />
            {(invalid || tooLow) && <p className="mt-1 text-xs text-danger">{invalid ? c.invalid : category === 'temperature' ? c.belowZero : c.negative}</p>}
          </div>
          <div>
            <label className="label" htmlFor="unit-from">
              {c.from}
            </label>
            <Select id="unit-from" value={fromUnit.id} onChange={setFrom} options={cat.units.map((x) => [x.id, `${c.names[x.id as keyof typeof c.names]} (${x.symbol})`] as const)} />
          </div>
          <p className="text-xs text-muted">{c.hint}</p>
        </aside>

        <section className="min-w-0">
          <ul className="panel divide-y divide-line px-2">
            {cat.units.map((x) => {
              const out = value === null || tooLow ? null : clean(convert(value, fromUnit, x));
              const selected = x.id === fromUnit.id;
              return (
                <li key={x.id} className="flex items-center gap-2 py-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (out === null) return;
                      setFrom(x.id);
                      setInput(String(out));
                    }}
                    aria-current={selected || undefined}
                    title={c.useAsBase}
                    className={`flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 rounded-[14px] px-3 py-2 text-left transition hover:bg-panel-2/60 ${selected ? 'bg-accent/10' : ''}`}
                  >
                    <span className="text-[13px] text-muted">
                      {c.names[x.id as keyof typeof c.names]} <span className="font-mono text-[12px]">({x.symbol})</span>
                    </span>
                    <span className={`font-mono text-[16px] tabular-nums break-all ${selected ? 'font-semibold text-accent' : ''}`}>{out === null ? '-' : fmt(out)}</span>
                  </button>
                  <CopyButton text={out === null ? '' : String(out)} className="h-8 shrink-0 px-3 text-xs" />
                </li>
              );
            })}
          </ul>
          {category === 'area' && <p className="mt-2 px-1 text-xs text-muted">{c.pyeongNote}</p>}
          {category === 'data' && <p className="mt-2 px-1 text-xs text-muted">{c.dataNote}</p>}
          {category === 'volume' && <p className="mt-2 px-1 text-xs text-muted">{c.volumeNote}</p>}
        </section>
      </div>
    </div>
  );
}

export default withI18n(UnitConverter);
