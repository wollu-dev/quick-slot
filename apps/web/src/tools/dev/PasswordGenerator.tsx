import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, ShieldCheck } from 'lucide-react';
import CopyButton from '../../components/ui/CopyButton';
import NumberField from '../../components/ui/NumberField';
import TextPanel from '../../components/ui/TextPanel';
import { useT, withI18n } from '../../i18n';

type SetKey = 'upper' | 'lower' | 'digits' | 'symbols';

const SETS: Record<SetKey, string> = {
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lower: 'abcdefghijklmnopqrstuvwxyz',
  digits: '0123456789',
  // No quotes, backslash or space: they often break when pasted into config files or shells
  symbols: '!#$%&()*+,-./:;<=>?@[]^_{|}~',
};
/** Characters that are easy to mix up when read or typed by hand */
const AMBIGUOUS = new Set('Il1|O0o');

const MIN_LENGTH = 4;
const MAX_LENGTH = 128;

/** Uniform random integer in [0, n) without modulo bias (rejection sampling on 32-bit values) */
function randomInt(n: number): number {
  const limit = Math.floor(0x1_0000_0000 / n) * n;
  const buf = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buf);
    if (buf[0] < limit) return buf[0] % n;
  }
}

/** Fisher-Yates shuffle with the unbiased random above */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * One password using only the chosen sets, with at least one character from each set
 * (so "digits" really means the password contains a digit).
 */
function generate(length: number, pools: string[]): string {
  const all = pools.join('');
  const chars = pools.map((p) => p[randomInt(p.length)]);
  while (chars.length < length) chars.push(all[randomInt(all.length)]);
  return shuffle(chars).join('');
}

/** Bits of entropy for a random password of this length over this many symbols */
const entropyBits = (length: number, poolSize: number) => (poolSize > 1 ? length * Math.log2(poolSize) : 0);

type Strength = 'weak' | 'fair' | 'strong' | 'veryStrong';
const strengthOf = (bits: number): Strength => (bits < 45 ? 'weak' : bits < 65 ? 'fair' : bits < 90 ? 'strong' : 'veryStrong');
const STRENGTH_STYLE: Record<Strength, { bar: string; text: string; fill: number }> = {
  weak: { bar: 'bg-danger', text: 'text-danger', fill: 0.25 },
  fair: { bar: 'bg-accent', text: 'text-accent', fill: 0.5 },
  strong: { bar: 'bg-ok', text: 'text-ok', fill: 0.75 },
  veryStrong: { bar: 'bg-ok', text: 'text-ok', fill: 1 },
};

function PasswordGenerator() {
  const t = useT();
  const p = t.password;
  const [length, setLength] = useState(20);
  const [sets, setSets] = useState<Record<SetKey, boolean>>({ upper: true, lower: true, digits: true, symbols: true });
  const [noAmbiguous, setNoAmbiguous] = useState(false);
  const [count, setCount] = useState(1);
  const [list, setList] = useState<string[]>([]);

  const pools = useMemo(
    () =>
      (Object.keys(SETS) as SetKey[])
        .filter((k) => sets[k])
        .map((k) => [...SETS[k]].filter((c) => !noAmbiguous || !AMBIGUOUS.has(c)).join(''))
        .filter(Boolean),
    [sets, noAmbiguous],
  );
  const poolSize = pools.reduce((n, s) => n + s.length, 0);
  // Every chosen set must fit at least once
  const len = Math.max(length, pools.length, MIN_LENGTH);

  const regenerate = useCallback(() => {
    setList(pools.length ? Array.from({ length: count }, () => generate(len, pools)) : []);
  }, [pools, len, count]);

  // New passwords whenever a setting changes
  useEffect(regenerate, [regenerate]);

  const bits = entropyBits(len, poolSize);
  const strength = strengthOf(bits);
  const style = STRENGTH_STYLE[strength];
  const first = list[0] ?? '';

  const toggle = (k: SetKey) => {
    const next = { ...sets, [k]: !sets[k] };
    // Keep at least one set selected
    if (Object.values(next).some(Boolean)) setSets(next);
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="panel space-y-4 self-start p-4">
        <div>
          <label className="label" htmlFor="pw-length">
            {p.length(MIN_LENGTH, MAX_LENGTH)}
          </label>
          <NumberField id="pw-length" min={MIN_LENGTH} max={MAX_LENGTH} value={length} onChange={setLength} />
        </div>
        <fieldset className="space-y-1.5 text-sm">
          <legend className="label">{p.include}</legend>
          {(Object.keys(SETS) as SetKey[]).map((k) => (
            <label key={k} className="flex items-center gap-2">
              <input type="checkbox" checked={sets[k]} onChange={() => toggle(k)} />
              <span className="flex-1">{p[k]}</span>
              <span className="font-mono text-xs text-muted">{k === 'symbols' ? '!#$%…' : `${SETS[k][0]}-${SETS[k].at(-1)}`}</span>
            </label>
          ))}
        </fieldset>
        <label className="flex items-center gap-2 border-t border-line pt-4 text-sm">
          <input type="checkbox" checked={noAmbiguous} onChange={(e) => setNoAmbiguous(e.target.checked)} />
          <span className="flex-1">{p.noAmbiguous}</span>
          <span className="font-mono text-xs text-muted">I l 1 | O 0 o</span>
        </label>
        <div className="border-t border-line pt-4">
          <label className="label" htmlFor="pw-count">
            {p.count}
          </label>
          <NumberField id="pw-count" min={1} max={100} value={count} onChange={setCount} />
        </div>
      </aside>

      <section className="min-w-0 space-y-3">
        <div className="panel p-5">
          <p className="font-mono text-[22px] leading-snug break-all select-all sm:text-[26px]" aria-live="polite">
            {first}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1 basis-48">
              <div className="h-1.5 overflow-hidden rounded-full bg-panel-2" aria-hidden>
                <div className={`h-full rounded-full transition-all ${style.bar}`} style={{ width: `${style.fill * 100}%` }} />
              </div>
              <p className="mt-1.5 text-[13px]">
                <span className={`font-semibold ${style.text}`}>{p.strength[strength]}</span>
                <span className="text-muted"> · {p.bits(Math.round(bits))}</span>
              </p>
            </div>
            <button type="button" className="btn" onClick={regenerate}>
              <RefreshCw size={15} strokeWidth={2.2} />
              {p.regenerate}
            </button>
            <CopyButton text={first} />
          </div>
        </div>

        {list.length > 1 && <TextPanel label={p.all(list.length)} value={list.join('\n')} actions={<CopyButton text={list.join('\n')} label={p.copyAll} />} minHeight="min-h-[30vh]" />}

        <p className="flex items-start gap-2 px-1 text-[13px] text-muted">
          <ShieldCheck size={15} className="mt-0.5 shrink-0 text-ok" />
          {p.note}
        </p>
      </section>
    </div>
  );
}

export default withI18n(PasswordGenerator);
