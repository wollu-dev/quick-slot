import { useEffect, useRef, useState } from 'react';
import { CheckSquare, Download, LoaderCircle, RotateCcw, RotateCw, Square, Trash2, Undo2 } from 'lucide-react';
import DropZone from '../../components/ui/DropZone';
import NumberField from '../../components/ui/NumberField';
import Segmented from '../../components/ui/Segmented';
import { useT, withI18n } from '../../i18n';
import Rich from '../../i18n/Rich';
import { downloadBlob, formatBytes, makeZip } from '../../lib/files';
import { buildPdf, inspectPdf, openForRender, parseRanges, PdfError, renderPage, type PageRangeError, type PdfErrorCode, type RenderDoc } from '../../lib/pdf';

interface Page {
  /** 0-based index in the source file */
  src: number;
  rotate: number;
  removed: boolean;
}

type Output = 'save' | 'extract' | 'split';
type SplitMode = 'every' | 'ranges';

const THUMB = 150;

function PdfSplit() {
  const t = useT();
  const s = t.pdfSplit;
  const [file, setFile] = useState<File | null>(null);
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [error, setError] = useState<PdfErrorCode | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [thumbs, setThumbs] = useState<Record<number, string>>({});
  const [output, setOutput] = useState<Output>('save');
  const [splitMode, setSplitMode] = useState<SplitMode>('every');
  const [every, setEvery] = useState(1);
  const [groups, setGroups] = useState('');
  const [selectText, setSelectText] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [dragging, setDragging] = useState<number | null>(null);

  const doc = useRef<RenderDoc | null>(null);
  const queue = useRef<number[]>([]);
  const rendering = useRef(false);
  const urls = useRef<string[]>([]);

  const cleanup = () => {
    doc.current?.close();
    doc.current = null;
    queue.current = [];
    urls.current.forEach((u) => URL.revokeObjectURL(u));
    urls.current = [];
  };
  useEffect(() => cleanup, []);

  const load = async (f: File) => {
    cleanup();
    setFile(f);
    setError(null);
    setPages([]);
    setSelected(new Set());
    setThumbs({});
    setFailed(false);
    try {
      const b = new Uint8Array(await f.arrayBuffer());
      const info = await inspectPdf(b);
      setBytes(b);
      setPages(Array.from({ length: info.pages }, (_, i) => ({ src: i, rotate: 0, removed: false })));
      doc.current = await openForRender(b).catch(() => null);
      // Tiles that became visible before the renderer was ready are waiting in the queue
      pump();
    } catch (e) {
      setError(e instanceof PdfError ? e.code : 'corrupt');
    }
  };

  /** Thumbnails are drawn one at a time, as their tiles scroll into view */
  const requestThumb = (src: number) => {
    if (queue.current.includes(src)) return;
    queue.current.push(src);
    pump();
  };
  const pump = async () => {
    if (rendering.current) return;
    rendering.current = true;
    while (queue.current.length && doc.current) {
      const src = queue.current.shift()!;
      try {
        const url = URL.createObjectURL(await renderPage(doc.current.doc, src + 1, THUMB * 2));
        urls.current.push(url);
        setThumbs((m) => ({ ...m, [src]: url }));
      } catch {
        /* leave the placeholder */
      }
    }
    rendering.current = false;
  };

  const kept = pages.filter((p) => !p.removed);
  /** Position among kept pages (1-based), which is what page numbers in ranges refer to */
  const numberOf = new Map(kept.map((p, i) => [p.src, i + 1]));
  const selectedKept = kept.filter((p) => selected.has(p.src));

  const toggle = (src: number) =>
    setSelected((set) => {
      const next = new Set(set);
      if (next.has(src)) next.delete(src);
      else next.add(src);
      return next;
    });
  const patchSelected = (fn: (p: Page) => Page) => setPages((list) => list.map((p) => (selected.has(p.src) ? fn(p) : p)));

  const selectParsed = parseRanges(selectText, kept.length);
  const applySelect = () => {
    if ('error' in selectParsed) return;
    setSelected(new Set(selectParsed.pages.map((i) => kept[i].src)));
  };

  // Groups of pages (as kept-page positions) for the chosen output
  let plan: { groups: number[][]; error?: PageRangeError } = { groups: [] };
  if (output === 'save') plan = { groups: [kept.map((_, i) => i)] };
  else if (output === 'extract') plan = { groups: [kept.map((p, i) => (selected.has(p.src) ? i : -1)).filter((i) => i >= 0)] };
  else if (splitMode === 'every') {
    const n = Math.max(1, every || 1);
    const g: number[][] = [];
    for (let i = 0; i < kept.length; i += n) g.push(kept.slice(i, i + n).map((_, k) => i + k));
    plan = { groups: g };
  } else {
    const g: number[][] = [];
    for (const part of groups.split(/[;\n]/)) {
      if (!part.trim()) continue;
      const r = parseRanges(part, kept.length);
      if ('error' in r) {
        plan = { groups: [], error: r.error };
        break;
      }
      g.push(r.pages);
    }
    if (!plan.error) plan = { groups: g };
  }
  const usable = plan.groups.filter((g) => g.length);

  const base = file ? file.name.replace(/\.pdf$/i, '') : 'document';
  const label = (g: number[]) => {
    const a = g[0] + 1;
    const b = g[g.length - 1] + 1;
    // A run in either direction reads as p3-5 or p5-3; anything else also notes how many pages it holds
    const step = g.length > 1 ? g[1] - g[0] : 0;
    const run = (step === 1 || step === -1) && g.every((v, i) => i === 0 || v - g[i - 1] === step);
    return g.length === 1 ? `p${a}` : run ? `p${a}-${b}` : `p${a}-${b}_${g.length}`;
  };

  const run = async () => {
    setBusy(true);
    setFailed(false);
    try {
      const build = (g: number[]) => buildPdf([{ bytes: bytes!, pages: g.map((i) => kept[i].src), rotate: g.map((i) => kept[i].rotate) }]);
      if (usable.length === 1) {
        const out = await build(usable[0]);
        const suffix = output === 'save' ? '_edited' : `_${label(usable[0])}`;
        downloadBlob(new Blob([out as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }), `${base}${suffix}.pdf`);
      } else {
        const entries = [];
        for (const g of usable) entries.push({ name: `${base}_${label(g)}.pdf`, data: await build(g) });
        downloadBlob(makeZip(entries), `${base}_split.zip`);
      }
    } catch {
      setFailed(true);
    }
    setBusy(false);
  };

  if (!file) {
    return (
      <div className="space-y-4">
        <DropZone onFiles={(f) => load(f[0])} accept="application/pdf,.pdf" multiple={false} hint={s.dropHint} />
        <p className="text-sm text-muted">
          <Rich text={s.intro} />
        </p>
      </div>
    );
  }

  const edited = pages.some((p, i) => p.src !== i || p.rotate || p.removed);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="panel min-w-0 space-y-4 self-start p-4 lg:sticky lg:top-24">
        <div className="min-w-0">
          <h3 className="truncate font-mono text-sm" title={file.name}>
            {file.name}
          </h3>
          {bytes && <p className="mt-1 text-sm text-muted">{s.info(pages.length, kept.length, formatBytes(file.size))}</p>}
          {error && <p className="mt-2 text-sm text-danger">{t.pdfMerge.errors[error]}</p>}
        </div>

        {bytes && (
          <>
            <div className="space-y-2 border-t border-line pt-4">
              <div className="flex items-center justify-between gap-2">
                <span className="label">{s.selection(selectedKept.length)}</span>
                <button
                  type="button"
                  className="text-xs text-accent"
                  onClick={() => setSelected(selectedKept.length === kept.length ? new Set() : new Set(kept.map((p) => p.src)))}
                >
                  {selectedKept.length === kept.length ? s.selectNone : s.selectAll}
                </button>
              </div>
              <div className="flex gap-2">
                <input
                  className={`input min-w-0 flex-1 text-[13px] ${'error' in selectParsed ? 'ring-2 ring-danger/50' : ''}`}
                  value={selectText}
                  onChange={(e) => setSelectText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && applySelect()}
                  placeholder="1-3, 5"
                  aria-label={s.selectByRange}
                />
                <button type="button" className="btn" disabled={!selectText.trim() || 'error' in selectParsed} onClick={applySelect}>
                  {s.select}
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button type="button" className="btn px-2" disabled={!selectedKept.length} title={s.rotateLeft} aria-label={s.rotateLeft} onClick={() => patchSelected((p) => ({ ...p, rotate: (p.rotate + 270) % 360 }))}>
                  <RotateCcw size={15} />
                </button>
                <button type="button" className="btn px-2" disabled={!selectedKept.length} title={s.rotateRight} aria-label={s.rotateRight} onClick={() => patchSelected((p) => ({ ...p, rotate: (p.rotate + 90) % 360 }))}>
                  <RotateCw size={15} />
                </button>
                <button
                  type="button"
                  className="btn px-2"
                  disabled={!selectedKept.length}
                  title={s.remove}
                  aria-label={s.remove}
                  onClick={() => {
                    patchSelected((p) => ({ ...p, removed: true }));
                    setSelected(new Set());
                  }}
                >
                  <Trash2 size={15} />
                </button>
              </div>
              {edited && (
                <button
                  type="button"
                  className="btn w-full"
                  onClick={() => setPages((list) => [...list].sort((a, b) => a.src - b.src).map((p) => ({ ...p, rotate: 0, removed: false })))}
                >
                  <Undo2 size={15} />
                  {s.undoAll}
                </button>
              )}
            </div>

            <div className="space-y-3 border-t border-line pt-4">
              <Segmented
                label={s.output}
                value={output}
                onChange={setOutput}
                options={[
                  ['save', s.outputs.save],
                  ['extract', s.outputs.extract],
                  ['split', s.outputs.split],
                ]}
              />
              {output === 'split' && (
                <div className="space-y-2">
                  <Segmented
                    label={s.splitBy}
                    value={splitMode}
                    onChange={setSplitMode}
                    options={[
                      ['every', s.splitModes.every],
                      ['ranges', s.splitModes.ranges],
                    ]}
                  />
                  {splitMode === 'every' ? (
                    <div className="flex items-center gap-2">
                      <NumberField id="ps-every" value={every} onChange={setEvery} min={1} max={Math.max(1, kept.length)} className="min-w-0 flex-1" />
                      <span className="text-sm text-muted">{s.pagesEach}</span>
                    </div>
                  ) : (
                    <input
                      className={`input w-full text-[13px] ${plan.error ? 'ring-2 ring-danger/50' : ''}`}
                      value={groups}
                      onChange={(e) => setGroups(e.target.value)}
                      placeholder="1-3; 4-10; 11-"
                      aria-label={s.splitModes.ranges}
                    />
                  )}
                </div>
              )}
              <p className={`text-xs ${plan.error ? 'text-danger' : 'text-muted'}`}>
                {plan.error ? t.pdfMerge.rangeErrors[plan.error.code](plan.error.token) : output === 'extract' && !usable.length ? s.pickPages : s.plan[output](usable.length, usable.reduce((n, g) => n + g.length, 0))}
              </p>
              <button type="button" className="btn btn-primary w-full" disabled={!usable.length || busy || !!plan.error} onClick={run}>
                {busy ? <LoaderCircle size={15} className="animate-spin" /> : <Download size={15} strokeWidth={2.2} />}
                {usable.length > 1 ? s.downloadZip(usable.length) : s.download}
              </button>
              {failed && <p className="text-sm text-danger">{t.pdfMerge.failed}</p>}
              <button
                type="button"
                className="btn w-full"
                onClick={() => {
                  cleanup();
                  setFile(null);
                  setBytes(null);
                }}
              >
                {s.otherPdf}
              </button>
            </div>
          </>
        )}
        {error && (
          <button type="button" className="btn w-full" onClick={() => setFile(null)}>
            {s.otherPdf}
          </button>
        )}
      </aside>

      {bytes && (
        <section className="min-w-0">
          <p className="mb-3 text-xs text-muted">{s.gridHint}</p>
          <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
            {pages.map((p, idx) => (
              <Tile
                key={p.src}
                page={p}
                number={numberOf.get(p.src)}
                thumb={thumbs[p.src]}
                selected={selected.has(p.src)}
                dragging={dragging === idx}
                onVisible={() => requestThumb(p.src)}
                onToggle={() => !p.removed && toggle(p.src)}
                onRotate={() => setPages((list) => list.map((x) => (x.src === p.src ? { ...x, rotate: (x.rotate + 90) % 360 } : x)))}
                onRemove={() => {
                  setPages((list) => list.map((x) => (x.src === p.src ? { ...x, removed: !x.removed } : x)));
                  setSelected((set) => {
                    const next = new Set(set);
                    next.delete(p.src);
                    return next;
                  });
                }}
                onDragStart={() => setDragging(idx)}
                onDragOver={() => {
                  if (dragging === null || dragging === idx) return;
                  setPages((list) => {
                    const next = [...list];
                    const [x] = next.splice(dragging, 1);
                    next.splice(idx, 0, x);
                    return next;
                  });
                  setDragging(idx);
                }}
                onDragEnd={() => setDragging(null)}
              />
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

interface TileProps {
  page: Page;
  number?: number;
  thumb?: string;
  selected: boolean;
  dragging: boolean;
  onVisible: () => void;
  onToggle: () => void;
  onRotate: () => void;
  onRemove: () => void;
  onDragStart: () => void;
  onDragOver: () => void;
  onDragEnd: () => void;
}

function Tile({ page, number, thumb, selected, dragging, onVisible, onToggle, onRotate, onRemove, onDragStart, onDragOver, onDragEnd }: TileProps) {
  const s = useT().pdfSplit;
  const ref = useRef<HTMLLIElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || thumb) return;
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && onVisible(), { rootMargin: '300px' });
    io.observe(el);
    return () => io.disconnect();
  }, [thumb]);

  return (
    <li
      ref={ref}
      draggable={!page.removed}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        onDragStart();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver();
      }}
      onDragEnd={onDragEnd}
      className={`group relative rounded-[18px] p-2 transition ${selected ? 'bg-accent/12 ring-2 ring-accent' : 'bg-panel ring-1 ring-line'} ${dragging ? 'opacity-40' : ''}`}
    >
      <button type="button" className="block w-full" onClick={onToggle} aria-pressed={selected} aria-label={number ? s.pageLabel(number, page.src + 1) : s.removedLabel(page.src + 1)}>
        <span className="grid aspect-[3/4] place-items-center overflow-hidden rounded-xl bg-panel-2">
          {thumb ? (
            <img src={thumb} alt="" draggable={false} className={`max-h-full max-w-full object-contain shadow-sm transition-transform ${page.removed ? 'opacity-25 grayscale' : ''}`} style={{ transform: `rotate(${page.rotate}deg)` }} />
          ) : (
            <LoaderCircle size={16} className="animate-spin text-muted" />
          )}
        </span>
      </button>
      <div className="mt-1.5 flex items-center justify-between gap-1">
        <span className="flex min-w-0 items-center gap-1.5 text-xs">
          {selected ? <CheckSquare size={14} className="shrink-0 text-accent" /> : <Square size={14} className="shrink-0 text-muted" />}
          {page.removed ? <span className="text-danger line-through">{page.src + 1}</span> : <span className="font-medium">{number}</span>}
          {!page.removed && number !== page.src + 1 && <span className="truncate text-muted">({s.wasPage(page.src + 1)})</span>}
        </span>
        <span className="flex shrink-0">
          {!page.removed && (
            <button type="button" className="grid size-7 place-items-center rounded-full text-muted hover:bg-panel-2 hover:text-fg" title={s.rotateRight} aria-label={s.rotateRight} onClick={onRotate}>
              <RotateCw size={13} />
            </button>
          )}
          <button
            type="button"
            className="grid size-7 place-items-center rounded-full text-muted hover:bg-panel-2 hover:text-fg"
            title={page.removed ? s.restore : s.remove}
            aria-label={page.removed ? s.restore : s.remove}
            onClick={onRemove}
          >
            {page.removed ? <Undo2 size={13} /> : <Trash2 size={13} />}
          </button>
        </span>
      </div>
    </li>
  );
}

export default withI18n(PdfSplit);
