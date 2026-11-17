import { useState } from 'react';
import CopyButton from '../../components/ui/CopyButton';
import NumberField from '../../components/ui/NumberField';
import Segmented from '../../components/ui/Segmented';
import { LANG_TAGS, useLang, useT, withI18n } from '../../i18n';
import { bitLength, formatRadix, fromTwos, parseRadix, toTwos, type RadixError } from '../../lib/radix';

type Key = 'bin' | 'oct' | 'dec' | 'hex' | 'custom';
type Width = '8' | '16' | '32' | '64';

/** Customary digit groups; other bases are shown ungrouped */
const GROUP: Record<number, number> = { 2: 4, 8: 3, 10: 3, 16: 4 };

function NumberBase() {
  const t = useT();
  const r = t.numberBase;
  const lang = useLang();
  const [value, setValue] = useState<bigint | null>(255n);
  const [editing, setEditing] = useState<{ key: Key; text: string; error?: RadixError; at?: string } | null>(null);
  const [customBase, setCustomBase] = useState(36);
  const [group, setGroup] = useState(true);
  const [upper, setUpper] = useState(true);
  const [width, setWidth] = useState<Width>('8');

  const fields: { key: Key; base: number; label: string; prefix: string }[] = [
    { key: 'bin', base: 2, label: r.bin, prefix: '0b' },
    { key: 'oct', base: 8, label: r.oct, prefix: '0o' },
    { key: 'dec', base: 10, label: r.dec, prefix: '' },
    { key: 'hex', base: 16, label: r.hex, prefix: '0x' },
    { key: 'custom', base: customBase, label: r.custom(customBase), prefix: '' },
  ];

  const show = (base: number) => (value === null ? '' : formatRadix(value, base, { group: group ? (GROUP[base] ?? 0) : 0, upper }));
  const plain = (base: number) => (value === null ? '' : formatRadix(value, base, { upper }));

  const onInput = (key: Key, base: number, text: string) => {
    const p = parseRadix(text, base);
    if ('value' in p) {
      setValue(p.value);
      setEditing({ key, text });
    } else {
      if (p.error === 'empty') setValue(null);
      setEditing({ key, text, error: p.error === 'empty' ? undefined : p.error, at: p.at });
    }
  };

  const bits = Number(width);
  const pattern = value === null ? null : toTwos(value, bits);
  const num = (v: bigint) => v.toLocaleString(LANG_TAGS[lang]);
  /** Flips one bit of the pattern; keeps the sign convention of the current value */
  const flip = (i: number) => {
    if (pattern === null) return;
    const next = pattern ^ (1n << BigInt(i));
    setValue(value !== null && value < 0n ? fromTwos(next, bits) : next);
    setEditing(null);
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className="panel min-w-0 divide-y divide-line">
        {fields.map((f) => {
          const active = editing?.key === f.key;
          const text = active ? editing.text : show(f.base);
          const err = active && editing.error;
          // A prefix in front of a minus sign (0x -1F) reads wrong, so negative numbers show none
          const prefix = text.trim().startsWith('-') ? '' : f.prefix;
          return (
            <div key={f.key} className="space-y-1.5 p-4">
              <div className="flex items-center justify-between gap-2">
                <label className="label" htmlFor={`nb-${f.key}`}>
                  {f.label}
                </label>
                {f.key === 'custom' && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted">{r.base}</span>
                    <NumberField
                      id="nb-base"
                      value={customBase}
                      onChange={(b) => {
                        setCustomBase(b);
                        if (editing?.key === 'custom') setEditing(null);
                      }}
                      min={2}
                      max={36}
                      className="w-32"
                    />
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="relative min-w-0 flex-1">
                  {prefix && <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 font-mono text-[13px] text-muted">{prefix}</span>}
                  <input
                    id={`nb-${f.key}`}
                    className={`input w-full font-mono text-[14px] ${prefix ? 'pl-9' : ''} ${err ? 'ring-2 ring-danger/50' : ''}`}
                    value={text}
                    onChange={(e) => onInput(f.key, f.base, e.target.value)}
                    onBlur={() => !editing?.error && setEditing(null)}
                    spellCheck={false}
                    autoComplete="off"
                    inputMode={f.base <= 10 ? 'numeric' : 'text'}
                    aria-invalid={!!err}
                  />
                </div>
                <CopyButton text={plain(f.base)} />
              </div>
              {err && <p className="text-xs text-danger">{r.badDigit(editing.at ?? '', f.base)}</p>}
            </div>
          );
        })}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 p-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={group} onChange={(e) => setGroup(e.target.checked)} />
            {r.group}
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={upper} onChange={(e) => setUpper(e.target.checked)} />
            {r.upper}
          </label>
          {value !== null && <span className="ml-auto text-xs text-muted">{r.size(bitLength(value), Math.ceil(bitLength(value) / 8))}</span>}
        </div>
      </section>

      <aside className="min-w-0 space-y-4 self-start">
        <div className="panel space-y-3 p-4">
          <h3 className="label">{r.twos}</h3>
          <Segmented
            label={r.width}
            value={width}
            onChange={setWidth}
            options={[
              ['8', '8'],
              ['16', '16'],
              ['32', '32'],
              ['64', '64'],
            ]}
          />
          {value === null ? (
            <p className="text-sm text-muted">{r.empty}</p>
          ) : pattern === null ? (
            <p className="text-sm text-danger">{r.doesNotFit(bits)}</p>
          ) : (
            <>
              <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-sm">
                <dt className="text-muted">{r.hex}</dt>
                <dd className="font-mono break-all">0x{formatRadix(pattern, 16, { upper: true }).padStart(bits / 4, '0')}</dd>
                <dt className="text-muted">{r.unsigned}</dt>
                <dd className="font-mono break-all">{num(pattern)}</dd>
                <dt className="text-muted">{r.signed}</dt>
                <dd className="font-mono break-all">{num(fromTwos(pattern, bits))}</dd>
              </dl>
              {/* One button per bit, most significant first; clicking flips it */}
              <div className={`grid ${bits === 8 ? 'grid-cols-8 gap-1' : 'grid-cols-16 gap-0.5'}`} role="group" aria-label={r.bits}>
                {Array.from({ length: bits }, (_, k) => bits - 1 - k).map((i) => {
                  const on = (pattern >> BigInt(i)) & 1n;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => flip(i)}
                      title={r.bit(i)}
                      aria-label={r.bit(i)}
                      aria-pressed={!!on}
                      className={`grid h-7 place-items-center rounded-full font-mono text-[11px] ${on ? 'bg-accent text-accent-fg' : 'bg-panel-2 text-muted hover:text-fg'}`}
                    >
                      {on ? 1 : 0}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted">{r.bitHint}</p>
            </>
          )}
        </div>
        <p className="px-1 text-xs text-muted">{r.note}</p>
      </aside>
    </div>
  );
}

export default withI18n(NumberBase);
