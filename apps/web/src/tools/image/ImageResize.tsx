import { useEffect, useRef, useState } from 'react';
import { Download, LoaderCircle, Move, X } from 'lucide-react';
import DropZone from '../../components/ui/DropZone';
import NumberField from '../../components/ui/NumberField';
import Segmented from '../../components/ui/Segmented';
import Select from '../../components/ui/Select';
import { useT, withI18n } from '../../i18n';
import Rich from '../../i18n/Rich';
import { downloadBlob, formatBytes, makeZip, timestampForFilename } from '../../lib/files';
import type { FormatId } from '../../lib/convert/formats';
import { ACCEPT, CompressError, outputFormat, outputName, sourceFormat, type CompressErrorCode } from '../../lib/imageCompress';
import { imageSize, planResize, resizeImage, type Fit, type Focus, type ResizeFormat, type ResizeOptions, type ResizeResult, type SizeMode } from '../../lib/imageResize';

interface Item {
  id: number;
  file: File;
  source?: FormatId;
  size?: { width: number; height: number };
  focus: Focus;
  status: 'detecting' | 'queued' | 'working' | 'done' | 'error';
  result?: ResizeResult;
  error?: CompressErrorCode;
}

/** Common target sizes (width × height, filled and cropped) */
const PRESETS = [
  ['square', 1080, 1080],
  ['portrait', 1080, 1350],
  ['story', 1080, 1920],
  ['hd', 1920, 1080],
  ['thumb', 1280, 720],
  ['profile', 400, 400],
] as const;
type PresetId = (typeof PRESETS)[number][0];

let nextId = 1;

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

function ImageResize() {
  const t = useT();
  const r = t.imgResize;
  const [items, setItems] = useState<Item[]>([]);
  const [opts, setOpts] = useState<ResizeOptions>({ mode: 'pixels', percent: 50, width: 1920, height: '', fit: 'contain', longSide: 1920, noUpscale: true, format: 'keep', quality: 0.9 });
  const [applied, setApplied] = useState(opts);
  const [suffix, setSuffix] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const busy = useRef(false);
  const version = useRef(0);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const [tick, setTick] = useState(0);

  // Apply settings a moment after the last change, then redo every image
  useEffect(() => {
    if (opts === applied) return;
    const timer = setTimeout(() => {
      setApplied(opts);
      version.current += 1;
      setItems((list) => list.map((i) => (i.status === 'done' || i.status === 'working' ? { ...i, status: 'queued' } : i)));
    }, 350);
    return () => clearTimeout(timer);
  }, [opts, applied]);

  const update = (id: number, patch: Partial<Item>) => setItems((list) => list.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  const set = (patch: Partial<ResizeOptions>) => setOpts((o) => ({ ...o, ...patch }));

  const add = (files: File[]) => {
    const added: Item[] = files.map((file) => ({ id: nextId++, file, focus: { x: 0.5, y: 0.5 }, status: 'detecting' }));
    setItems((list) => [...list, ...added]);
    if (selected === null && added.length) setSelected(added[0].id);
    for (const it of added) {
      (async () => {
        const source = await sourceFormat(it.file);
        if (!source) return update(it.id, { status: 'error', error: 'unsupported' });
        try {
          update(it.id, { source, size: await imageSize(it.file, source), status: 'queued' });
        } catch {
          update(it.id, { status: 'error', error: 'decode' });
        }
      })();
    }
  };

  useEffect(() => {
    if (busy.current) return;
    const next = items.find((i) => i.status === 'queued');
    if (!next) return;
    busy.current = true;
    const v = version.current;
    const focus = next.focus;
    update(next.id, { status: 'working' });
    resizeImage(next.file, next.source!, applied, focus)
      .then((result) => {
        // Settings or the crop position changed meanwhile: the item has been queued again
        const now = itemsRef.current.find((i) => i.id === next.id);
        if (v !== version.current || !now || now.focus !== focus) return;
        update(next.id, { status: 'done', result });
      })
      .catch((e) => v === version.current && update(next.id, { status: 'error', error: e instanceof CompressError ? e.code : 'encode' }))
      .finally(() => {
        busy.current = false;
        setTick((n) => n + 1);
      });
  }, [items, applied, tick]);

  const done = items.filter((i) => i.status === 'done' && i.result);
  // Settings changed but not applied yet: results on screen are about to be redone
  const changing = opts !== applied;
  const working = changing || items.some((i) => i.status === 'queued' || i.status === 'working' || i.status === 'detecting');
  const nameOf = (i: Item) => outputName(i.file.name, i.result!.format, suffix ? `-${i.result!.width}x${i.result!.height}` : '');
  const downloadAll = async () => {
    if (done.length === 1) return downloadBlob(done[0].result!.blob, nameOf(done[0]));
    const entries = await Promise.all(done.map(async (i) => ({ name: nameOf(i), data: new Uint8Array(await i.result!.blob.arrayBuffer()) })));
    downloadBlob(makeZip(entries), `quickslot-resized-${timestampForFilename()}.zip`);
  };

  const preset = PRESETS.find(([, w, h]) => opts.mode === 'pixels' && opts.fit === 'cover' && opts.width === w && opts.height === h)?.[0] ?? 'custom';
  const both = opts.mode === 'pixels' && !!opts.width && !!opts.height;
  const sources = items.map((i) => i.source).filter(Boolean) as FormatId[];
  const lossy = opts.format === 'keep' ? !sources.length || sources.some((s) => outputFormat(s, 'keep') !== 'png') : opts.format !== 'png';

  if (!items.length) {
    return (
      <div className="space-y-4">
        <DropZone onFiles={add} accept={ACCEPT} hint={r.dropHint} />
        <p className="text-sm text-muted">
          <Rich text={r.intro} />
        </p>
      </div>
    );
  }

  const sel = items.find((i) => i.id === selected) ?? items[0];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="panel min-w-0 space-y-4 self-start p-4">
        <Segmented
          label={r.sizeBy}
          value={opts.mode}
          onChange={(mode: SizeMode) => set({ mode })}
          options={[
            ['pixels', r.byPixels],
            ['percent', r.byPercent],
            ['long', r.byLong],
          ]}
        />

        {opts.mode === 'pixels' && (
          <div className="space-y-3">
            <div className="space-y-2">
              <label className="label" htmlFor="ir-preset">
                {r.preset}
              </label>
              <Select
                id="ir-preset"
                value={preset as PresetId | 'custom'}
                onChange={(id) => {
                  const p = PRESETS.find(([k]) => k === id);
                  if (p) set({ width: p[1], height: p[2], fit: 'cover' });
                }}
                options={[['custom', r.custom] as const, ...PRESETS.map(([k, w, h]) => [k, `${r.presets[k]} · ${w}×${h}`] as const)]}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="label" htmlFor="ir-w">
                  {r.width}
                </label>
                <NumberField id="ir-w" value={opts.width} onChange={(width) => set({ width })} min={1} max={16384} allowEmpty placeholder={r.auto} />
              </div>
              <div className="space-y-1">
                <label className="label" htmlFor="ir-h">
                  {r.height}
                </label>
                <NumberField id="ir-h" value={opts.height} onChange={(height) => set({ height })} min={1} max={16384} allowEmpty placeholder={r.auto} />
              </div>
            </div>
            <p className="text-xs text-muted">{both ? r.fitNotes[opts.fit] : r.autoNote}</p>
            {both && (
              <Segmented
                label={r.fit}
                value={opts.fit}
                onChange={(fit: Fit) => set({ fit })}
                options={[
                  ['contain', r.fits.contain],
                  ['cover', r.fits.cover],
                  ['stretch', r.fits.stretch],
                ]}
              />
            )}
          </div>
        )}

        {opts.mode === 'percent' && (
          <div className="space-y-2">
            <label className="label" htmlFor="ir-pct">
              {r.percent}
            </label>
            <div className="flex items-center gap-2">
              <NumberField id="ir-pct" value={opts.percent} onChange={(percent) => set({ percent })} min={1} max={1000} className="min-w-0 flex-1" />
              <span className="text-sm text-muted">%</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[25, 50, 75].map((p) => (
                <button key={p} type="button" className={`btn h-8 px-3 text-xs ${opts.percent === p ? 'btn-tinted' : ''}`} onClick={() => set({ percent: p })}>
                  {p}%
                </button>
              ))}
            </div>
          </div>
        )}

        {opts.mode === 'long' && (
          <div className="space-y-2">
            <label className="label" htmlFor="ir-long">
              {r.longSide}
            </label>
            <div className="flex items-center gap-2">
              <NumberField id="ir-long" value={opts.longSide} onChange={(longSide) => set({ longSide })} min={1} max={16384} className="min-w-0 flex-1" />
              <span className="text-sm text-muted">px</span>
            </div>
            <p className="text-xs text-muted">{r.longNote}</p>
          </div>
        )}

        <label className="flex items-start gap-2 border-t border-line pt-4 text-sm">
          <input type="checkbox" className="mt-1" checked={opts.noUpscale} onChange={(e) => set({ noUpscale: e.target.checked })} />
          <span>
            {r.noUpscale}
            <span className="block text-xs text-muted">{r.noUpscaleNote}</span>
          </span>
        </label>

        <div className="space-y-2 border-t border-line pt-4">
          <label className="label" htmlFor="ir-format">
            {r.format}
          </label>
          <Select
            id="ir-format"
            value={opts.format}
            onChange={(format: ResizeFormat) => set({ format })}
            options={[
              ['keep', t.imgCompress.keep],
              ['jpeg', 'JPEG'],
              ['png', 'PNG'],
              ['webp', 'WebP'],
            ]}
          />
          {lossy && (
            <div className="space-y-1 pt-1">
              <div className="flex items-center justify-between">
                <label className="text-sm" htmlFor="ir-quality">
                  {t.imgCompress.quality}
                </label>
                <span className="font-mono text-sm">{Math.round(opts.quality * 100)}</span>
              </div>
              <input id="ir-quality" type="range" min={0.5} max={1} step={0.05} value={opts.quality} onChange={(e) => set({ quality: Number(e.target.value) })} className="w-full accent-accent" />
            </div>
          )}
        </div>

        <label className="flex items-start gap-2 border-t border-line pt-4 text-sm">
          <input type="checkbox" className="mt-1" checked={suffix} onChange={(e) => setSuffix(e.target.checked)} />
          <span>
            {r.suffix}
            <span className="block text-xs text-muted">{r.suffixNote}</span>
          </span>
        </label>

        <div className="space-y-2 border-t border-line pt-4">
          <button type="button" className="btn btn-primary w-full" disabled={!done.length || working} onClick={downloadAll}>
            {working ? <LoaderCircle size={15} className="animate-spin" /> : <Download size={15} strokeWidth={2.2} />}
            {working ? r.working : done.length > 1 ? t.common.zipDownload(done.length) : t.imgCompress.downloadOne}
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
        </div>
      </aside>

      <section className="min-w-0 space-y-3">
        {sel?.size && sel.source && (
          <Preview
            item={sel}
            opts={opts}
            onFocus={(focus) => {
              setItems((list) => list.map((i) => (i.id === sel.id ? { ...i, focus, status: i.status === 'error' ? i.status : 'queued' } : i)));
            }}
          />
        )}
        <DropZone onFiles={add} accept={ACCEPT} compact />
        <ul className="panel divide-y divide-line overflow-hidden">
          {items.map((i) => (
            <Row
              key={i.id}
              item={i}
              name={i.result ? nameOf(i) : i.file.name}
              active={i.id === sel?.id}
              changing={changing}
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

function Row({ item, name, active, changing, onSelect, onRemove }: { item: Item; name: string; active: boolean; changing: boolean; onSelect: () => void; onRemove: () => void }) {
  const t = useT();
  const thumb = useObjectUrl(item.result?.blob);
  const res = item.result;
  const fresh = item.status === 'done' && !changing && res;
  return (
    <li className={`flex items-center gap-3 py-2 pr-1.5 pl-2 ${active ? 'bg-accent/8' : ''}`}>
      <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={onSelect} aria-pressed={active}>
        <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-panel-2">
          {thumb ? <img src={thumb} alt="" className="size-full object-cover" /> : item.status !== 'error' && <LoaderCircle size={16} className="animate-spin text-muted" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm" title={name}>
            {name}
          </span>
          <span className="block text-xs text-muted">
            {item.status === 'error' ? (
              <span className="text-danger">{t.imgCompress.errors[item.error ?? 'encode']}</span>
            ) : (
              <>
                {item.size ? `${item.size.width}×${item.size.height}` : '…'}
                {' → '}
                {fresh ? (
                  <>
                    <span className="font-medium text-fg">
                      {res.width}×{res.height}
                    </span>
                    {' · '}
                    {formatBytes(res.blob.size)}
                  </>
                ) : (
                  t.imgResize.working
                )}
              </>
            )}
          </span>
        </span>
      </button>
      {fresh && (
        <button
          type="button"
          className="grid size-8 shrink-0 place-items-center rounded-full text-muted hover:bg-panel-2 hover:text-fg"
          title={t.imgCompress.downloadOne}
          aria-label={t.imgCompress.downloadOne}
          onClick={() => downloadBlob(res.blob, name)}
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

/**
 * The original with the area that will be kept. When filling a box, the crop window can be
 * dragged (or moved with the arrow keys) to choose what stays in the picture.
 */
function Preview({ item, opts, onFocus }: { item: Item; opts: ResizeOptions; onFocus: (f: Focus) => void }) {
  const r = useT().imgResize;
  const { width: W, height: H } = item.size!;
  const plan = planResize(W, H, opts, item.focus);
  const showOriginal = item.source !== 'heic';
  const original = useObjectUrl(showOriginal ? item.file : undefined);
  const result = useObjectUrl(!showOriginal ? item.result?.blob : undefined);
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; focus: Focus } | null>(null);
  const [focus, setFocus] = useState(item.focus);
  useEffect(() => setFocus(item.focus), [item.focus, item.id]);
  const movable = plan.cropped && showOriginal;
  const live = movable ? planResize(W, H, opts, focus) : plan;

  const moveBy = (dx: number, dy: number, from: Focus) => {
    const rect = box.current!.getBoundingClientRect();
    const freeX = W - live.sw;
    const freeY = H - live.sh;
    const scale = W / rect.width;
    return {
      x: freeX > 0 ? Math.min(1, Math.max(0, from.x + (dx * scale) / freeX)) : 0.5,
      y: freeY > 0 ? Math.min(1, Math.max(0, from.y + (dy * scale) / freeY)) : 0.5,
    };
  };

  const pct = (v: number, of: number) => `${(v / of) * 100}%`;
  return (
    <figure className="panel overflow-hidden">
      <div className="bg-[repeating-conic-gradient(var(--color-panel-2)_0_25%,transparent_0_50%)] bg-[length:16px_16px] p-3">
        <div ref={box} className="relative mx-auto touch-none select-none" style={{ aspectRatio: `${W} / ${H}`, maxHeight: '55vh', maxWidth: '100%' }}>
          {showOriginal ? <img src={original} alt="" className="absolute inset-0 size-full" draggable={false} /> : result && <img src={result} alt="" className="absolute inset-0 size-full object-contain" />}
          {plan.cropped && showOriginal && (
            <>
              {/* Dim what gets cut off */}
              <div
                className="pointer-events-none absolute inset-0 bg-bg/65"
                style={{
                  clipPath: `polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${pct(live.sx, W)} ${pct(live.sy, H)}, ${pct(live.sx, W)} ${pct(live.sy + live.sh, H)}, ${pct(live.sx + live.sw, W)} ${pct(live.sy + live.sh, H)}, ${pct(live.sx + live.sw, W)} ${pct(live.sy, H)}, ${pct(live.sx, W)} ${pct(live.sy, H)})`,
                }}
              />
              <div
                role="slider"
                tabIndex={0}
                aria-label={r.cropPosition}
                aria-valuetext={`${Math.round(focus.x * 100)}%, ${Math.round(focus.y * 100)}%`}
                className="absolute cursor-move rounded-[4px] border-2 border-accent outline-none focus-visible:ring-4 focus-visible:ring-accent/30"
                style={{ left: pct(live.sx, W), top: pct(live.sy, H), width: pct(live.sw, W), height: pct(live.sh, H) }}
                onPointerDown={(e) => {
                  (e.target as HTMLElement).setPointerCapture(e.pointerId);
                  drag.current = { x: e.clientX, y: e.clientY, focus };
                }}
                onPointerMove={(e) => drag.current && setFocus(moveBy(e.clientX - drag.current.x, e.clientY - drag.current.y, drag.current.focus))}
                onPointerUp={() => {
                  if (drag.current) onFocus(focus);
                  drag.current = null;
                }}
                onKeyDown={(e) => {
                  const step = e.shiftKey ? 0.1 : 0.02;
                  const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
                  if (!d) return;
                  e.preventDefault();
                  const next = { x: Math.min(1, Math.max(0, focus.x + d[0])), y: Math.min(1, Math.max(0, focus.y + d[1])) };
                  setFocus(next);
                  onFocus(next);
                }}
              >
                <span className="glass-menu absolute top-1/2 left-1/2 grid size-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-fg">
                  <Move size={16} />
                </span>
              </div>
            </>
          )}
        </div>
      </div>
      <figcaption className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-2.5 text-xs text-muted">
        <span>
          {W}×{H} → <span className="font-medium text-fg">{plan.width}×{plan.height}</span>
        </span>
        <span>{movable ? r.dragHint : !showOriginal ? r.heicNoPreview : ''}</span>
      </figcaption>
    </figure>
  );
}

export default withI18n(ImageResize);
