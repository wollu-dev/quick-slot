import { useDeferredValue, useMemo, useState, type ReactNode } from 'react';
import { ArrowUpDown, ChevronsUpDown } from 'lucide-react';
import { createTwoFilesPatch, diffArrays, diffChars, diffWords, diffWordsWithSpace, type ChangeObject } from 'diff';
import CopyButton from '../../components/ui/CopyButton';
import Segmented from '../../components/ui/Segmented';
import TextPanel from '../../components/ui/TextPanel';
import { LANG_TAGS, useLang, useT, withI18n } from '../../i18n';

type Unit = 'line' | 'word' | 'char';

interface Row {
  kind: 'same' | 'del' | 'add';
  oldNo?: number;
  newNo?: number;
  text: string;
  /** Word-level parts for a changed line that pairs with a line on the other side */
  parts?: ChangeObject<string>[];
}

/** Unchanged runs longer than this are folded, keeping CONTEXT lines on each side */
const FOLD_OVER = 8;
const CONTEXT = 3;

const splitLines = (v: string) => {
  const lines = v.split('\n');
  if (lines.at(-1) === '') lines.pop();
  return lines;
};

const SAMPLE_A = `QuickSlot is a set of tools
that run in your browser.
Files never leave your device.
Pin your favorite tools to the dock.`;
const SAMPLE_B = `QuickSlot is a set of handy tools
that run right in your browser.
Files are processed on your device.
Pin your favorite tools to the dock.
Open them with Alt+1 to 9.`;

function TextDiff() {
  const t = useT();
  const d = t.diff;
  const lang = useLang();
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [unit, setUnit] = useState<Unit>('line');
  const [ignoreCase, setIgnoreCase] = useState(false);
  const [ignoreSpace, setIgnoreSpace] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  // Diffing large texts can take a moment; keep typing responsive
  const da = useDeferredValue(a);
  const db = useDeferredValue(b);

  const segmenter = useMemo(() => (typeof Intl.Segmenter === 'function' ? new Intl.Segmenter(LANG_TAGS[lang], { granularity: 'word' }) : undefined), [lang]);

  const changes = useMemo(() => {
    if (!da && !db) return [];
    if (unit === 'line') {
      // Line by line with our own comparison, so "ignore case" works for lines too (diffLines has no such option)
      const norm = (l: string) => {
        const x = ignoreSpace ? l.trim().replace(/\s+/g, ' ') : l;
        return ignoreCase ? x.toLowerCase() : x;
      };
      return diffArrays(splitLines(da), splitLines(db), { comparator: (x: string, y: string) => norm(x) === norm(y) }).map(
        (c): ChangeObject<string> => ({ ...c, value: c.value.map((l) => l + '\n').join(''), count: c.value.length }),
      );
    }
    if (unit === 'char') return diffChars(da, db, { ignoreCase });
    return ignoreSpace ? diffWords(da, db, { ignoreCase, intlSegmenter: segmenter }) : diffWordsWithSpace(da, db, { ignoreCase, intlSegmenter: segmenter });
  }, [da, db, unit, ignoreCase, ignoreSpace, segmenter]);

  /** Line view rows with line numbers; a removed block followed by an added one gets word highlights */
  const rows = useMemo(() => {
    if (unit !== 'line') return [];
    const out: Row[] = [];
    let oldNo = 1;
    let newNo = 1;
    for (let i = 0; i < changes.length; i++) {
      const c = changes[i];
      const lines = splitLines(c.value);
      if (c.removed && changes[i + 1]?.added) {
        const added = splitLines(changes[i + 1].value);
        const pairs = Math.min(lines.length, added.length);
        const word = (x: string, y: string) => diffWordsWithSpace(x, y, { ignoreCase, intlSegmenter: segmenter });
        lines.forEach((text, j) => out.push({ kind: 'del', oldNo: oldNo++, text, parts: j < pairs ? word(text, added[j]).filter((p) => !p.added) : undefined }));
        added.forEach((text, j) => out.push({ kind: 'add', newNo: newNo++, text, parts: j < pairs ? word(lines[j], text).filter((p) => !p.removed) : undefined }));
        i++;
      } else if (c.removed) lines.forEach((text) => out.push({ kind: 'del', oldNo: oldNo++, text }));
      else if (c.added) lines.forEach((text) => out.push({ kind: 'add', newNo: newNo++, text }));
      else lines.forEach((text) => out.push({ kind: 'same', oldNo: oldNo++, newNo: newNo++, text }));
    }
    return out;
  }, [changes, unit, ignoreCase, segmenter]);

  const added = changes.filter((c) => c.added).reduce((n, c) => n + (unit === 'line' ? splitLines(c.value).length : c.count ?? 0), 0);
  const removed = changes.filter((c) => c.removed).reduce((n, c) => n + (unit === 'line' ? splitLines(c.value).length : c.count ?? 0), 0);
  const identical = (da || db) && added === 0 && removed === 0;
  // ASCII file names in the patch header: the library quotes non-ASCII names as octal escapes
  const patch = unit === 'line' && (da || db) && !identical ? createTwoFilesPatch('original', 'changed', da, db) : '';
  const unitLabel = d.units[unit];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <TextPanel
          label={d.original}
          value={a}
          onChange={setA}
          placeholder={d.placeholderA}
          minHeight="min-h-[24vh]"
          actions={
            <button
              type="button"
              className="btn"
              onClick={() => {
                setA(SAMPLE_A);
                setB(SAMPLE_B);
              }}
            >
              {d.sample}
            </button>
          }
        />
        <TextPanel
          label={d.changed}
          value={b}
          onChange={setB}
          placeholder={d.placeholderB}
          minHeight="min-h-[24vh]"
          actions={
            <button
              type="button"
              className="btn"
              title={d.swap}
              aria-label={d.swap}
              onClick={() => {
                setA(b);
                setB(a);
              }}
            >
              <ArrowUpDown size={15} strokeWidth={2.2} />
              <span className="hidden sm:inline">{d.swap}</span>
            </button>
          }
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Segmented
          label={d.compareBy}
          value={unit}
          onChange={(u) => {
            setUnit(u);
            setExpanded(new Set());
          }}
          options={[
            ['line', d.byLine],
            ['word', d.byWord],
            ['char', d.byChar],
          ]}
        />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={ignoreCase} onChange={(e) => setIgnoreCase(e.target.checked)} />
          {d.ignoreCase}
        </label>
        {unit !== 'char' && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={ignoreSpace} onChange={(e) => setIgnoreSpace(e.target.checked)} />
            {d.ignoreSpace}
          </label>
        )}
      </div>

      <section className="panel overflow-hidden" aria-label={d.result}>
        <header className="flex min-h-12 flex-wrap items-center justify-between gap-2 border-b border-line py-1.5 pr-1.5 pl-4">
          <h3 className="text-[13px] font-medium text-muted">
            {d.result}
            {(da || db) && !identical && (
              <span className="ml-3 font-mono">
                <span className="text-ok">+{added.toLocaleString(LANG_TAGS[lang])}</span> <span className="text-danger">−{removed.toLocaleString(LANG_TAGS[lang])}</span> <span>{unitLabel}</span>
              </span>
            )}
          </h3>
          {patch && <CopyButton text={patch} label={d.copyPatch} />}
        </header>

        {!da && !db ? (
          <p className="p-6 text-center text-sm text-muted">{d.empty}</p>
        ) : identical ? (
          <p className="p-6 text-center text-sm font-medium text-ok">{d.identical}</p>
        ) : unit === 'line' ? (
          <LineView rows={rows} expanded={expanded} onExpand={(i) => setExpanded(new Set(expanded).add(i))} foldLabel={d.folded} />
        ) : (
          <p className="p-4 font-mono text-[13px] leading-relaxed break-words whitespace-pre-wrap">
            {changes.map((c, i) => (
              <Part key={i} change={c} />
            ))}
          </p>
        )}
      </section>
    </div>
  );
}

function Part({ change, strong }: { change: ChangeObject<string>; strong?: boolean }) {
  if (change.added) return <ins className={`rounded-[3px] text-ok no-underline ${strong ? 'bg-ok/25' : 'bg-ok/15'}`}>{change.value}</ins>;
  if (change.removed) return <del className={`rounded-[3px] text-danger ${strong ? 'bg-danger/25' : 'bg-danger/15'}`}>{change.value}</del>;
  return <>{change.value}</>;
}

function LineView({ rows, expanded, onExpand, foldLabel }: { rows: Row[]; expanded: Set<number>; onExpand: (start: number) => void; foldLabel: (n: number) => string }) {
  const out: ReactNode[] = [];
  for (let i = 0; i < rows.length; ) {
    if (rows[i].kind === 'same') {
      let j = i;
      while (j < rows.length && rows[j].kind === 'same') j++;
      const run = j - i;
      const head = i === 0 ? 0 : CONTEXT;
      const tail = j === rows.length ? 0 : CONTEXT;
      if (run > FOLD_OVER && run - head - tail > 1 && !expanded.has(i)) {
        for (let k = i; k < i + head; k++) out.push(<Line key={k} row={rows[k]} />);
        const start = i;
        out.push(
          <button
            key={`fold-${i}`}
            type="button"
            onClick={() => onExpand(start)}
            className="flex w-full items-center gap-2 bg-panel-2/60 px-4 py-1.5 text-left text-[12px] text-muted hover:bg-panel-2 hover:text-fg"
          >
            <ChevronsUpDown size={13} />
            {foldLabel(run - head - tail)}
          </button>,
        );
        for (let k = j - tail; k < j; k++) out.push(<Line key={k} row={rows[k]} />);
      } else for (let k = i; k < j; k++) out.push(<Line key={k} row={rows[k]} />);
      i = j;
    } else {
      out.push(<Line key={i} row={rows[i]} />);
      i++;
    }
  }
  return <div className="overflow-x-auto py-1 font-mono text-[13px] leading-relaxed">{out}</div>;
}

function Line({ row }: { row: Row }) {
  const bg = row.kind === 'del' ? 'bg-danger/8' : row.kind === 'add' ? 'bg-ok/8' : '';
  const sign = row.kind === 'del' ? '−' : row.kind === 'add' ? '+' : ' ';
  const signColor = row.kind === 'del' ? 'text-danger' : row.kind === 'add' ? 'text-ok' : '';
  return (
    <div className={`grid min-w-max grid-cols-[2.75rem_2.75rem_1.5rem_1fr] ${bg}`}>
      <span className="pr-2 text-right text-muted/70 select-none">{row.oldNo ?? ''}</span>
      <span className="pr-2 text-right text-muted/70 select-none">{row.newNo ?? ''}</span>
      <span className={`text-center select-none ${signColor}`}>{sign}</span>
      <span className="pr-4 whitespace-pre">{row.parts ? row.parts.map((p, k) => <Part key={k} change={p} strong />) : row.text || ' '}</span>
    </div>
  );
}

export default withI18n(TextDiff);
