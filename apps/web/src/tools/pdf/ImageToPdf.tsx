import { useEffect, useRef, useState } from 'react';
import { ArrowDownAZ, FileDown, LoaderCircle, RotateCw, X } from 'lucide-react';
import DropZone from '../../components/ui/DropZone';
import Segmented from '../../components/ui/Segmented';
import Select from '../../components/ui/Select';
import { useT, withI18n } from '../../i18n';
import Rich from '../../i18n/Rich';
import { downloadBlob, formatBytes } from '../../lib/files';
import type { FormatId } from '../../lib/convert/formats';
import { ACCEPT, sourceFormat } from '../../lib/imageCompress';
import { imagesToPdf, layout, preview, type LayoutOptions, type Orientation, type PageSize } from '../../lib/imagePdf';

interface Item {
  id: number;
  file: File;
  source?: FormatId;
  width?: number;
  height?: number;
  thumb?: string;
  rotate: number;
  error?: 'unsupported' | 'decode';
}

let nextId = 1;

function ImageToPdf() {
  const t = useT();
  const p = t.imagePdf;
  const [items, setItems] = useState<Item[]>([]);
  const [opts, setOpts] = useState<LayoutOptions>({ size: 'a4', orientation: 'auto', margin: 0 });
  const [optimize, setOptimize] = useState(false);
  const [name, setName] = useState('');
  const [progress, setProgress] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const [dragging, setDragging] = useState<number | null>(null);
  const urls = useRef<string[]>([]);
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const update = (id: number, patch: Partial<Item>) => setItems((list) => list.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const add = async (files: File[]) => {
    const added: Item[] = files.map((file) => ({ id: nextId++, file, rotate: 0 }));
    if (!items.length && added.length) setName(added[0].file.name.replace(/\.[^.]+$/, ''));
    setItems((list) => [...list, ...added]);
    for (const it of added) {
      const source = await sourceFormat(it.file);
      if (!source) {
        update(it.id, { error: 'unsupported' });
        continue;
      }
      try {
        const pv = await preview(it.file, source);
        const thumb = URL.createObjectURL(pv.thumb);
        urls.current.push(thumb);
        update(it.id, { source, width: pv.width, height: pv.height, thumb });
      } catch {
        update(it.id, { error: 'decode' });
      }
    }
  };

  const ready = items.filter((i) => i.thumb);
  const loading = items.some((i) => !i.thumb && !i.error);

  const create = async () => {
    setProgress(0);
    setFailed(false);
    try {
      const out = await imagesToPdf(
        ready.map((i) => ({ file: i.file, source: i.source!, width: i.width!, height: i.height!, rotate: i.rotate })),
        opts,
        optimize,
        setProgress,
      );
      downloadBlob(new Blob([out as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }), `${name.trim() || 'images'}.pdf`);
    } catch {
      setFailed(true);
    }
    setProgress(null);
  };

  if (!items.length) {
    return (
      <div className="space-y-4">
        <DropZone onFiles={add} accept={ACCEPT} hint={p.dropHint} />
        <p className="text-sm text-muted">
          <Rich text={p.intro} />
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="panel min-w-0 space-y-4 self-start p-4 lg:sticky lg:top-24">
        <div className="space-y-2">
          <label className="label" htmlFor="ip-size">
            {p.pageSize}
          </label>
          <Select
            id="ip-size"
            value={opts.size}
            onChange={(size: PageSize) => setOpts({ ...opts, size })}
            options={[
              ['fit', p.sizes.fit],
              ['a4', 'A4 (210 × 297 mm)'],
              ['letter', 'Letter (8.5 × 11 in)'],
              ['a5', 'A5 (148 × 210 mm)'],
            ]}
          />
        </div>
        {opts.size !== 'fit' && (
          <div className="space-y-2">
            <span className="label block">{p.orientation}</span>
            <Segmented
              label={p.orientation}
              value={opts.orientation}
              onChange={(orientation: Orientation) => setOpts({ ...opts, orientation })}
              options={[
                ['auto', p.orientations.auto],
                ['portrait', p.orientations.portrait],
                ['landscape', p.orientations.landscape],
              ]}
            />
          </div>
        )}
        <div className="space-y-2">
          <span className="label block">{p.margin}</span>
          <Segmented
            label={p.margin}
            value={String(opts.margin) as '0' | '10' | '20'}
            onChange={(v) => setOpts({ ...opts, margin: Number(v) })}
            options={[
              ['0', p.margins.none],
              ['10', p.margins.small],
              ['20', p.margins.large],
            ]}
          />
        </div>
        <label className="flex items-start gap-2 border-t border-line pt-4 text-sm">
          <input type="checkbox" className="mt-1" checked={optimize} onChange={(e) => setOptimize(e.target.checked)} />
          <span>
            {p.optimize}
            <span className="block text-xs text-muted">{optimize ? p.optimizeOn : p.optimizeOff}</span>
          </span>
        </label>
        <div className="space-y-2 border-t border-line pt-4">
          <label className="label" htmlFor="ip-name">
            {t.pdfMerge.fileName}
          </label>
          <div className="flex items-center gap-2">
            <input id="ip-name" className="input min-w-0 flex-1" value={name} onChange={(e) => setName(e.target.value.replace(/[\\/:*?"<>|]/g, ''))} spellCheck={false} />
            <span className="text-sm text-muted">.pdf</span>
          </div>
        </div>
        <div className="space-y-2 border-t border-line pt-4">
          <p className="text-sm">
            <Rich text={p.summary(ready.length, formatBytes(ready.reduce((n, i) => n + i.file.size, 0)))} />
          </p>
          {progress !== null ? (
            <div className="flex h-9 items-center gap-3" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-panel-2">
                <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${progress * 100}%` }} />
              </div>
              <span className="font-mono text-xs text-muted">{Math.floor(progress * 100)}%</span>
            </div>
          ) : (
            <button type="button" className="btn btn-primary w-full" disabled={!ready.length || loading} onClick={create}>
              {loading ? <LoaderCircle size={15} className="animate-spin" /> : <FileDown size={15} strokeWidth={2.2} />}
              {p.create}
            </button>
          )}
          {failed && <p className="text-sm text-danger">{p.failed}</p>}
          <button
            type="button"
            className="btn w-full"
            onClick={() => setItems((list) => [...list].sort((a, b) => a.file.name.localeCompare(b.file.name, undefined, { numeric: true, sensitivity: 'base' })))}
          >
            <ArrowDownAZ size={15} strokeWidth={2.2} />
            {t.pdfMerge.sortByName}
          </button>
          <button type="button" className="btn w-full" onClick={() => setItems([])}>
            {t.common.reset}
          </button>
        </div>
      </aside>

      <section className="min-w-0 space-y-3">
        <DropZone onFiles={add} accept={ACCEPT} compact />
        <p className="text-xs text-muted">{p.gridHint}</p>
        <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
          {items.map((i, idx) => (
            <li
              key={i.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = 'move';
                setDragging(idx);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                if (dragging === null || dragging === idx) return;
                setItems((list) => {
                  const next = [...list];
                  const [x] = next.splice(dragging, 1);
                  next.splice(idx, 0, x);
                  return next;
                });
                setDragging(idx);
              }}
              onDragEnd={() => setDragging(null)}
              className={`rounded-[18px] bg-panel p-2 ring-1 ring-line transition ${dragging === idx ? 'opacity-40' : ''}`}
            >
              <div className="grid aspect-[3/4] place-items-center">
                {i.thumb ? <PagePreview item={i} opts={opts} /> : i.error ? <span className="px-2 text-center text-xs text-danger">{p.errors[i.error]}</span> : <LoaderCircle size={16} className="animate-spin text-muted" />}
              </div>
              <div className="mt-1.5 flex items-center gap-1">
                <span className="font-mono text-xs text-muted">{idx + 1}</span>
                <span className="min-w-0 flex-1 truncate text-xs" title={i.file.name}>
                  {i.file.name}
                </span>
                {i.thumb && (
                  <button
                    type="button"
                    className="grid size-7 shrink-0 place-items-center rounded-full text-muted hover:bg-panel-2 hover:text-fg"
                    title={t.pdfSplit.rotateRight}
                    aria-label={t.pdfSplit.rotateRight}
                    onClick={() => update(i.id, { rotate: (i.rotate + 90) % 360 })}
                  >
                    <RotateCw size={13} />
                  </button>
                )}
                <button
                  type="button"
                  className="grid size-7 shrink-0 place-items-center rounded-full text-muted hover:bg-panel-2 hover:text-fg"
                  title={t.common.removeFromList}
                  aria-label={t.common.removeFromList}
                  onClick={() => setItems((list) => list.filter((x) => x.id !== i.id))}
                >
                  <X size={13} />
                </button>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

/** The page as it will come out: its shape, the margins, and the image placed and rotated */
function PagePreview({ item, opts }: { item: Item; opts: LayoutOptions }) {
  const l = layout({ width: item.width!, height: item.height!, rotate: item.rotate }, opts);
  const turned = item.rotate % 180 !== 0;
  const pct = (v: number, of: number) => `${(v / of) * 100}%`;
  return (
    <div
      className="relative max-h-full max-w-full overflow-hidden rounded-[4px] bg-panel-2 shadow-sm ring-1 ring-line"
      style={l.pw >= l.ph ? { width: '100%', aspectRatio: `${l.pw} / ${l.ph}` } : { height: '100%', aspectRatio: `${l.pw} / ${l.ph}` }}
    >
      <div className="absolute overflow-hidden" style={{ left: pct(l.bx, l.pw), bottom: pct(l.by, l.ph), width: pct(l.bw, l.pw), height: pct(l.bh, l.ph) }}>
        <img
          src={item.thumb}
          alt=""
          draggable={false}
          className="absolute top-1/2 left-1/2 max-w-none"
          style={{
            width: turned ? pct(l.bh, l.bw) : '100%',
            height: turned ? pct(l.bw, l.bh) : '100%',
            transform: `translate(-50%, -50%) rotate(${item.rotate}deg)`,
          }}
        />
      </div>
    </div>
  );
}

export default withI18n(ImageToPdf);
