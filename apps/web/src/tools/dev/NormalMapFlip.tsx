import { useEffect, useRef, useState } from 'react';
import { Download, LoaderCircle, X } from 'lucide-react';
import DropZone from '../../components/ui/DropZone';
import Segmented from '../../components/ui/Segmented';
import { useT, withI18n } from '../../i18n';
import Rich from '../../i18n/Rich';
import { downloadBlob, formatBytes, makeZip, timestampForFilename } from '../../lib/files';
import { ACCEPT, convertedName, encodeRaster, flipChannels, NormalError, readNormalMap, shade, type Convention, type FlipOptions, type NormalErrorCode, type Raster } from '../../lib/normalMap';

interface Item {
  id: number;
  file: File;
  raster?: Raster;
  error?: NormalErrorCode;
}

let nextId = 1;

/** Engines and tools by the green-channel convention they expect */
const ENGINES: Record<Convention, string[]> = {
  opengl: ['Unity', 'Godot', 'Blender', 'Maya', 'Marmoset Toolbag', 'Houdini'],
  directx: ['Unreal Engine', 'CryEngine', '3ds Max', 'Source', 'Substance Painter'],
};

function NormalMapFlip() {
  const t = useT();
  const n = t.normalMap;
  const [items, setItems] = useState<Item[]>([]);
  const [target, setTarget] = useState<Convention>('opengl');
  const [flip, setFlip] = useState<FlipOptions>({ green: true, red: false });
  const [rename, setRename] = useState(true);
  const [selected, setSelected] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const add = async (files: File[]) => {
    const added = files.map((file) => ({ id: nextId++, file }));
    setItems((list) => [...list, ...added]);
    if (selected === null && added.length) setSelected(added[0].id);
    // One at a time: large 16-bit maps take a lot of memory
    for (const it of added) {
      try {
        const raster = await readNormalMap(it.file);
        setItems((list) => list.map((i) => (i.id === it.id ? { ...i, raster } : i)));
      } catch (e) {
        setItems((list) => list.map((i) => (i.id === it.id ? { ...i, error: e instanceof NormalError ? e.code : 'corrupt' } : i)));
      }
    }
  };

  const ready = items.filter((i) => i.raster);
  const loading = items.some((i) => !i.raster && !i.error);
  const output = (i: Item) => {
    const enc = encodeRaster(flipChannels(i.raster!, flip));
    return { name: convertedName(i.file.name, enc.ext, target, rename), ...enc };
  };
  const saveOne = (i: Item) => {
    const o = output(i);
    downloadBlob(new Blob([o.bytes as Uint8Array<ArrayBuffer>], { type: o.mime }), o.name);
  };
  const saveAll = async () => {
    setBusy(true);
    // Let the button show its busy state before the encoding work starts
    await new Promise((r) => setTimeout(r, 30));
    try {
      if (ready.length === 1) saveOne(ready[0]);
      else
        downloadBlob(
          makeZip(ready.map((i) => output(i)).map((o) => ({ name: o.name, data: o.bytes }))),
          `quickslot-normal-${target === 'opengl' ? 'opengl' : 'directx'}-${timestampForFilename()}.zip`,
        );
    } finally {
      setBusy(false);
    }
  };

  const nothing = !flip.green && !flip.red;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="panel min-w-0 space-y-4 self-start p-4">
        <div className="space-y-2">
          <span className="label block">{n.direction}</span>
          <Segmented
            label={n.direction}
            value={target}
            onChange={setTarget}
            options={[
              ['opengl', n.toOpenGL],
              ['directx', n.toDirectX],
            ]}
          />
          <p className="text-xs text-muted">{n.sameOperation}</p>
        </div>

        <div className="space-y-2 border-t border-line pt-4 text-sm">
          <label className="flex items-start gap-2">
            <input type="checkbox" className="mt-1" checked={flip.green} onChange={(e) => setFlip({ ...flip, green: e.target.checked })} />
            <span>{n.flipGreen}</span>
          </label>
          <label className="flex items-start gap-2">
            <input type="checkbox" className="mt-1" checked={flip.red} onChange={(e) => setFlip({ ...flip, red: e.target.checked })} />
            <span>
              {n.flipRed}
              <span className="block text-xs text-muted">{n.flipRedNote}</span>
            </span>
          </label>
          {nothing && <p className="text-xs text-danger">{n.nothing}</p>}
        </div>

        <label className="flex items-start gap-2 border-t border-line pt-4 text-sm">
          <input type="checkbox" className="mt-1" checked={rename} onChange={(e) => setRename(e.target.checked)} />
          <span>
            {n.rename}
            <span className="block text-xs text-muted">{n.renameNote(target === 'opengl' ? 'rock_N_DX.png → rock_N_GL.png' : 'rock_N_GL.png → rock_N_DX.png')}</span>
          </span>
        </label>

        {items.length > 0 && (
          <div className="space-y-2 border-t border-line pt-4">
            <button type="button" className="btn btn-primary w-full" disabled={!ready.length || loading || busy || nothing} onClick={saveAll}>
              {loading || busy ? <LoaderCircle size={15} className="animate-spin" /> : <Download size={15} strokeWidth={2.2} />}
              {ready.length > 1 ? t.common.zipDownload(ready.length) : n.downloadOne}
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
        )}

        <div className="space-y-2 border-t border-line pt-4 text-xs">
          <p className="label">{n.whichEngine}</p>
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5">
            <dt className="font-medium">OpenGL (Y+)</dt>
            <dd className="text-muted">{ENGINES.opengl.join(', ')}</dd>
            <dt className="font-medium">DirectX (Y−)</dt>
            <dd className="text-muted">{ENGINES.directx.join(', ')}</dd>
          </dl>
        </div>
      </aside>

      <section className="min-w-0 space-y-3">
        {items.length === 0 ? (
          <>
            <DropZone onFiles={add} accept={ACCEPT} hint={n.dropHint} />
            <p className="text-sm text-muted">
              <Rich text={n.intro} />
            </p>
          </>
        ) : (
          <>
            <Preview item={items.find((i) => i.id === selected && i.raster) ?? ready[0]} flip={flip} />
            <DropZone onFiles={add} accept={ACCEPT} compact />
            <ul className="panel divide-y divide-line overflow-hidden">
              {items.map((i) => (
                <li key={i.id} className={`flex items-center gap-3 py-2 pr-1.5 pl-4 ${i.id === selected ? 'bg-accent/8' : ''}`}>
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setSelected(i.id)} disabled={!i.raster} aria-pressed={i.id === selected}>
                    <span className="block truncate text-sm" title={i.file.name}>
                      {i.raster ? convertedName(i.file.name, i.raster.kind === 'tga' ? 'tga' : 'png', target, rename) : i.file.name}
                    </span>
                    <span className="block text-xs text-muted">
                      {i.error ? (
                        <span className="text-danger">{n.errors[i.error]}</span>
                      ) : i.raster ? (
                        <>
                          {i.raster.width}×{i.raster.height} · {n.format(i.raster.kind === 'tga' ? 'TGA' : i.raster.kind === 'png' ? 'PNG' : (i.file.name.split('.').pop() ?? '').toUpperCase(), i.raster.depth, i.raster.channels === 4)} · {formatBytes(i.file.size)}
                          {i.raster.kind === 'other' && <span> · {n.toPng}</span>}
                        </>
                      ) : (
                        n.reading
                      )}
                    </span>
                  </button>
                  {i.raster && (
                    <button
                      type="button"
                      className="grid size-8 shrink-0 place-items-center rounded-full text-muted hover:bg-panel-2 hover:text-fg disabled:opacity-30"
                      title={n.downloadOne}
                      aria-label={n.downloadOne}
                      disabled={nothing}
                      onClick={() => saveOne(i)}
                    >
                      <Download size={15} strokeWidth={2.2} />
                    </button>
                  )}
                  <button
                    type="button"
                    className="grid size-8 shrink-0 place-items-center rounded-full text-muted hover:bg-panel-2 hover:text-fg"
                    title={t.common.removeFromList}
                    aria-label={t.common.removeFromList}
                    onClick={() => setItems((list) => list.filter((x) => x.id !== i.id))}
                  >
                    <X size={15} strokeWidth={2.2} />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}

/** Draws ImageData into a canvas that scales with its container */
function Shaded({ image, label }: { image: ImageData; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    c.width = image.width;
    c.height = image.height;
    c.getContext('2d')!.putImageData(image, 0, 0);
  }, [image]);
  return (
    <figure className="min-w-0 space-y-1.5">
      <canvas ref={ref} className="block w-full rounded-xl bg-panel-2" style={{ aspectRatio: `${image.width} / ${image.height}` }} aria-label={label} role="img" />
      <figcaption className="text-center text-xs text-muted">{label}</figcaption>
    </figure>
  );
}

function Preview({ item, flip }: { item?: Item; flip: FlipOptions }) {
  const n = useT().normalMap;
  const [images, setImages] = useState<[ImageData, ImageData] | null>(null);
  useEffect(() => {
    if (!item?.raster) return setImages(null);
    setImages([shade(item.raster, { green: false, red: false }), shade(item.raster, flip)]);
  }, [item?.raster, flip.green, flip.red]);
  if (!images) return null;
  return (
    <div className="panel space-y-3 p-4">
      <div className="grid grid-cols-2 gap-3">
        <Shaded image={images[0]} label={n.before} />
        <Shaded image={images[1]} label={n.after} />
      </div>
      <p className="text-xs text-muted">
        <Rich text={n.shadingNote} />
      </p>
    </div>
  );
}

export default withI18n(NormalMapFlip);
