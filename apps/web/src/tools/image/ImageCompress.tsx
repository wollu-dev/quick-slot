import { useEffect, useRef, useState } from 'react';
import { Download, LoaderCircle, X } from 'lucide-react';
import DropZone from '../../components/ui/DropZone';
import Select from '../../components/ui/Select';
import { LANG_TAGS, useLang, useT, withI18n } from '../../i18n';
import Rich from '../../i18n/Rich';
import { downloadBlob, formatBytes, makeZip, timestampForFilename } from '../../lib/files';
import type { FormatId } from '../../lib/convert/formats';
import {
  ACCEPT,
  compressImage,
  CompressError,
  outputFormat,
  outputName,
  sourceFormat,
  type CompressErrorCode,
  type CompressOptions,
  type CompressResult,
  type OutChoice,
} from '../../lib/imageCompress';

interface Item {
  id: number;
  file: File;
  source?: FormatId;
  status: 'detecting' | 'queued' | 'working' | 'done' | 'error';
  result?: CompressResult;
  error?: CompressErrorCode;
  /** Options version the result was made with */
  version?: number;
}

const SIDES = [0, 3840, 2560, 1920, 1280, 800] as const;
let nextId = 1;

/** Object URL for a blob, revoked when it changes */
function useObjectUrl(blob?: Blob) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!blob) {
      setUrl(undefined);
      return;
    }
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}

function ImageCompress() {
  const t = useT();
  const c = t.imgCompress;
  const lang = useLang();
  const [items, setItems] = useState<Item[]>([]);
  const [opts, setOpts] = useState<CompressOptions>({ format: 'keep', quality: 0.75, pngColors: false, maxSide: 0 });
  // Options in effect: applied a moment after the last change, so dragging the slider doesn't restart work on every step
  const [applied, setApplied] = useState(opts);
  const [version, setVersion] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const busy = useRef(false);
  const versionRef = useRef(0);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (opts === applied) return;
    const timer = setTimeout(() => {
      setApplied(opts);
      versionRef.current += 1;
      setVersion(versionRef.current);
      setItems((list) => list.map((i) => (i.status === 'done' || i.status === 'working' ? { ...i, status: 'queued' } : i)));
    }, 350);
    return () => clearTimeout(timer);
  }, [opts, applied]);

  const update = (id: number, patch: Partial<Item>) => setItems((list) => list.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const add = (files: File[]) => {
    const added: Item[] = files.map((file) => ({ id: nextId++, file, status: 'detecting' }));
    setItems((list) => [...list, ...added]);
    if (selected === null && added.length) setSelected(added[0].id);
    for (const it of added) {
      sourceFormat(it.file).then((source) => update(it.id, source ? { source, status: 'queued' } : { status: 'error', error: 'unsupported' }));
    }
  };

  // One image at a time, in order
  useEffect(() => {
    if (busy.current) return;
    const next = items.find((i) => i.status === 'queued');
    if (!next) return;
    busy.current = true;
    const v = versionRef.current;
    update(next.id, { status: 'working' });
    compressImage(next.file, next.source!, applied)
      .then((result) => {
        // Options changed while this was running: the item is queued again by the options effect
        if (v !== versionRef.current) return;
        update(next.id, { status: 'done', result, version: v, error: undefined });
      })
      .catch((e) => v === versionRef.current && update(next.id, { status: 'error', error: e instanceof CompressError ? e.code : 'encode' }))
      .finally(() => {
        busy.current = false;
        setTick((n) => n + 1);
      });
  }, [items, applied, tick]);

  const done = items.filter((i) => i.status === 'done' && i.result);
  const before = done.reduce((n, i) => n + i.file.size, 0);
  const after = done.reduce((n, i) => n + i.result!.blob.size, 0);
  const working = items.some((i) => i.status === 'queued' || i.status === 'working' || i.status === 'detecting');
  const pct = (a: number, b: number) => Math.round((1 - b / Math.max(1, a)) * 100);

  const sources = items.map((i) => i.source).filter(Boolean) as FormatId[];
  const anyLossy = opts.format === 'keep' ? sources.some((s) => outputFormat(s, 'keep') !== 'png') || !sources.length : opts.format !== 'png';
  const anyPng = opts.format === 'keep' ? sources.some((s) => outputFormat(s, 'keep') === 'png') || !sources.length : opts.format === 'png';

  const downloadAll = () => {
    if (done.length === 1) {
      const i = done[0];
      downloadBlob(i.result!.blob, outputName(i.file.name, i.result!.format));
      return;
    }
    Promise.all(done.map(async (i) => ({ name: outputName(i.file.name, i.result!.format), data: new Uint8Array(await i.result!.blob.arrayBuffer()) }))).then((entries) =>
      downloadBlob(makeZip(entries), `quickslot-compressed-${timestampForFilename()}.zip`),
    );
  };

  if (!items.length) {
    return (
      <div className="space-y-4">
        <DropZone onFiles={add} accept={ACCEPT} hint={c.dropHint} />
        <p className="text-sm text-muted">
          <Rich text={c.intro} />
        </p>
      </div>
    );
  }

  const sel = items.find((i) => i.id === selected) ?? done[0];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="panel min-w-0 space-y-4 self-start p-4">
        <div className="space-y-2">
          <label className="label" htmlFor="ic-format">
            {c.format}
          </label>
          <Select
            id="ic-format"
            value={opts.format}
            onChange={(format: OutChoice) => setOpts({ ...opts, format })}
            options={[
              ['keep', c.keep],
              ['jpeg', 'JPEG'],
              ['webp', 'WebP'],
              ['avif', 'AVIF'],
              ['png', 'PNG'],
            ]}
          />
          <p className="text-xs text-muted">{opts.format === 'keep' ? c.keepNote : opts.format === 'avif' ? c.avifNote : opts.format === 'webp' ? c.webpNote : c.formatNote}</p>
        </div>

        {anyLossy && (
          <div className="space-y-2 border-t border-line pt-4">
            <div className="flex items-center justify-between">
              <label className="label" htmlFor="ic-quality">
                {c.quality}
              </label>
              <span className="font-mono text-sm">{Math.round(opts.quality * 100)}</span>
            </div>
            <input
              id="ic-quality"
              type="range"
              min={0.3}
              max={0.95}
              step={0.05}
              value={opts.quality}
              onChange={(e) => setOpts({ ...opts, quality: Number(e.target.value) })}
              className="w-full accent-accent"
            />
            <div className="flex justify-between text-xs text-muted">
              <span>{c.smaller}</span>
              <span>{c.sharper}</span>
            </div>
          </div>
        )}

        {anyPng && (
          <label className="flex items-start gap-2 border-t border-line pt-4 text-sm">
            <input type="checkbox" className="mt-1" checked={opts.pngColors} onChange={(e) => setOpts({ ...opts, pngColors: e.target.checked })} />
            <span>
              {c.pngColors}
              <span className="block text-xs text-muted">{c.pngColorsNote}</span>
            </span>
          </label>
        )}

        <div className="space-y-2 border-t border-line pt-4">
          <label className="label" htmlFor="ic-side">
            {c.maxSide}
          </label>
          <Select
            id="ic-side"
            value={String(opts.maxSide)}
            onChange={(v) => setOpts({ ...opts, maxSide: Number(v) })}
            options={SIDES.map((s) => [String(s), s ? c.sidePx(s.toLocaleString(LANG_TAGS[lang])) : c.originalSize] as const)}
          />
        </div>

        <div className="space-y-2 border-t border-line pt-4">
          {done.length > 0 && (
            <p className="text-sm" aria-live="polite">
              <Rich text={c.total(formatBytes(before), formatBytes(after), pct(before, after))} />
            </p>
          )}
          <button type="button" className="btn btn-primary w-full" disabled={!done.length || working} onClick={downloadAll}>
            {working ? <LoaderCircle size={15} className="animate-spin" /> : <Download size={15} strokeWidth={2.2} />}
            {working ? c.working : done.length > 1 ? t.common.zipDownload(done.length) : c.downloadOne}
          </button>
          <button
            type="button"
            className="btn w-full"
            onClick={() => {
              setItems([]);
              setSelected(null);
            }}
          >
            {t.common.reset}
          </button>
          <p className="text-xs text-muted">{c.metaNote}</p>
        </div>
      </aside>

      <section className="min-w-0 space-y-3">
        {sel?.result && <Compare item={sel} />}
        <DropZone onFiles={add} accept={ACCEPT} compact />
        <ul className="panel divide-y divide-line overflow-hidden">
          {items.map((i) => (
            <Row
              key={i.id}
              item={i}
              active={i.id === sel?.id}
              stale={i.status === 'done' && i.version !== version}
              onSelect={() => setSelected(i.id)}
              onRemove={() => {
                setItems((list) => list.filter((x) => x.id !== i.id));
                if (selected === i.id) setSelected(null);
              }}
            />
          ))}
        </ul>
      </section>
    </div>
  );
}

function Row({ item, active, stale, onSelect, onRemove }: { item: Item; active: boolean; stale: boolean; onSelect: () => void; onRemove: () => void }) {
  const t = useT();
  const c = t.imgCompress;
  const thumb = useObjectUrl(item.result?.blob);
  const r = item.result;
  const saved = r ? Math.round((1 - r.blob.size / Math.max(1, item.file.size)) * 100) : 0;
  return (
    <li className={`flex items-center gap-3 py-2 pr-1.5 pl-2 ${active ? 'bg-accent/8' : ''}`}>
      <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={onSelect} disabled={!r} aria-pressed={active}>
        <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-panel-2">
          {thumb ? <img src={thumb} alt="" className="size-full object-cover" /> : <LoaderCircle size={16} className={item.status === 'error' ? 'hidden' : 'animate-spin text-muted'} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm" title={item.file.name}>
            {r ? outputName(item.file.name, r.format) : item.file.name}
          </span>
          <span className="block text-xs text-muted">
            {item.status === 'error' ? (
              <span className="text-danger">{c.errors[item.error ?? 'encode']}</span>
            ) : r && !stale && item.status === 'done' ? (
              <>
                {formatBytes(item.file.size)} → {formatBytes(r.blob.size)}
                {' · '}
                {r.keptOriginal ? <span>{c.keptOriginal}</span> : <span className={saved > 0 ? 'text-ok' : 'text-danger'}>{saved > 0 ? `−${saved}%` : `+${-saved}%`}</span>}
                <span className="hidden sm:inline">
                  {' · '}
                  {r.width}×{r.height}
                </span>
              </>
            ) : (
              <>
                {formatBytes(item.file.size)} · {c.working}
              </>
            )}
          </span>
        </span>
      </button>
      {r && item.status === 'done' && (
        <button
          type="button"
          className="grid size-8 shrink-0 place-items-center rounded-full text-muted hover:bg-panel-2 hover:text-fg"
          title={c.downloadOne}
          aria-label={c.downloadOne}
          onClick={() => downloadBlob(r.blob, outputName(item.file.name, r.format))}
        >
          <Download size={15} strokeWidth={2.2} />
        </button>
      )}
      <button
        type="button"
        className="grid size-8 shrink-0 place-items-center rounded-full text-muted hover:bg-panel-2 hover:text-fg"
        title={t.common.removeFromList}
        aria-label={t.common.removeFromList}
        onClick={onRemove}
      >
        <X size={15} strokeWidth={2.2} />
      </button>
    </li>
  );
}

/** Before / after with a draggable divider (a transparent range input on top handles mouse, touch and keyboard) */
function Compare({ item }: { item: Item }) {
  const c = useT().imgCompress;
  const [pos, setPos] = useState(50);
  const [zoom, setZoom] = useState(false);
  const before = useObjectUrl(item.file);
  const after = useObjectUrl(item.result!.blob);
  const { width, height } = item.result!;
  // HEIC can't be shown by most browsers: compare against the result only
  const canShowOriginal = item.source !== 'heic';
  return (
    <figure className="panel overflow-hidden">
      <div className={`relative bg-[repeating-conic-gradient(var(--color-panel-2)_0_25%,transparent_0_50%)] bg-[length:16px_16px] ${zoom ? 'max-h-[70vh] overflow-auto' : ''}`}>
        <div className="relative mx-auto" style={zoom ? { width, height } : { aspectRatio: `${width} / ${height}`, maxHeight: '60vh', maxWidth: '100%' }}>
          {canShowOriginal && <img src={before} alt="" className="absolute inset-0 size-full object-contain" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }} />}
          <img src={after} alt="" className="absolute inset-0 size-full object-contain" style={canShowOriginal ? { clipPath: `inset(0 0 0 ${pos}%)` } : undefined} />
          {canShowOriginal && (
            <>
              <div className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-accent" style={{ left: `${pos}%` }} />
              <span className="pointer-events-none absolute top-2 left-2 glass-menu rounded-full px-2.5 py-1 text-xs font-medium text-fg">{c.before}</span>
              <span className="pointer-events-none absolute top-2 right-2 glass-menu rounded-full px-2.5 py-1 text-xs font-medium text-fg">{c.after}</span>
              <input
                type="range"
                min={0}
                max={100}
                value={pos}
                onChange={(e) => setPos(Number(e.target.value))}
                aria-label={c.compare}
                className="absolute inset-0 size-full cursor-ew-resize opacity-0"
              />
            </>
          )}
        </div>
      </div>
      <figcaption className="flex flex-wrap items-center justify-between gap-2 border-t border-line py-1.5 pr-1.5 pl-4 text-xs text-muted">
        <span>{canShowOriginal ? c.compareHint : c.heicNoPreview}</span>
        <label className="flex items-center gap-2 text-sm text-fg">
          <input type="checkbox" checked={zoom} onChange={(e) => setZoom(e.target.checked)} />
          {c.actualSize}
        </label>
      </figcaption>
    </figure>
  );
}

export default withI18n(ImageCompress);
