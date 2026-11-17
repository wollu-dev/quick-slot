import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowDownAZ, ArrowUp, GripVertical, LoaderCircle, Merge, X } from 'lucide-react';
import DropZone from '../../components/ui/DropZone';
import { useT, withI18n } from '../../i18n';
import Rich from '../../i18n/Rich';
import { downloadBlob, formatBytes } from '../../lib/files';
import { buildPdf, inspectPdf, openForRender, parseRanges, PdfError, renderPage, type PdfErrorCode, type PdfInfo } from '../../lib/pdf';

interface Item {
  id: number;
  file: File;
  bytes?: Uint8Array;
  info?: PdfInfo;
  error?: PdfErrorCode;
  /** Pages to take, e.g. "1-3, 5"; empty = all */
  range: string;
  thumb?: string;
}

let nextId = 1;

function PdfMerge() {
  const t = useT();
  const m = t.pdfMerge;
  const [items, setItems] = useState<Item[]>([]);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [dragging, setDragging] = useState<number | null>(null);
  const urls = useRef<string[]>([]);
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const update = (id: number, patch: Partial<Item>) => setItems((list) => list.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const add = async (files: File[]) => {
    const added: Item[] = files.map((file) => ({ id: nextId++, file, range: '' }));
    if (!items.length && added.length) setName(`${added[0].file.name.replace(/\.pdf$/i, '')}_merged`);
    setItems((list) => [...list, ...added]);
    for (const it of added) {
      try {
        const bytes = new Uint8Array(await it.file.arrayBuffer());
        const info = await inspectPdf(bytes);
        update(it.id, { bytes, info });
        // The thumbnail is a nice-to-have: a page pdf.js can't draw doesn't block merging
        try {
          const { doc, close } = await openForRender(bytes);
          const url = URL.createObjectURL(await renderPage(doc, 1, 160));
          urls.current.push(url);
          await close();
          update(it.id, { thumb: url });
        } catch {
          /* no thumbnail */
        }
      } catch (e) {
        update(it.id, { error: e instanceof PdfError ? e.code : 'corrupt' });
      }
    }
  };

  const move = (from: number, to: number) =>
    setItems((list) => {
      if (to < 0 || to >= list.length) return list;
      const next = [...list];
      const [x] = next.splice(from, 1);
      next.splice(to, 0, x);
      return next;
    });

  const valid = items.filter((i) => i.info);
  const parsed = valid.map((i) => ({ item: i, r: parseRanges(i.range, i.info!.pages) }));
  const rangeError = parsed.some((p) => 'error' in p.r);
  const totalPages = parsed.reduce((n, p) => n + ('pages' in p.r ? p.r.pages.length : 0), 0);
  const loading = items.some((i) => !i.info && !i.error);

  const merge = async () => {
    setBusy(true);
    setFailed(false);
    try {
      const out = await buildPdf(parsed.map((p) => ({ bytes: p.item.bytes!, pages: 'pages' in p.r ? p.r.pages : [] })));
      downloadBlob(new Blob([out as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }), `${name.trim() || 'merged'}.pdf`);
    } catch {
      setFailed(true);
    }
    setBusy(false);
  };

  if (!items.length) {
    return (
      <div className="space-y-4">
        <DropZone onFiles={add} accept="application/pdf,.pdf" hint={m.dropHint} />
        <p className="text-sm text-muted">
          <Rich text={m.intro} />
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="panel min-w-0 space-y-4 self-start p-4">
        <div className="space-y-2">
          <label className="label" htmlFor="pm-name">
            {m.fileName}
          </label>
          <div className="flex items-center gap-2">
            <input id="pm-name" className="input min-w-0 flex-1" value={name} onChange={(e) => setName(e.target.value.replace(/[\\/:*?"<>|]/g, ''))} spellCheck={false} />
            <span className="text-sm text-muted">.pdf</span>
          </div>
        </div>
        <div className="space-y-2 border-t border-line pt-4">
          <p className="text-sm">
            <Rich text={m.summary(valid.length, totalPages)} />
          </p>
          {rangeError && <p className="text-sm text-danger">{m.fixRanges}</p>}
          <button type="button" className="btn btn-primary w-full" disabled={!valid.length || loading || busy || rangeError || !totalPages} onClick={merge}>
            {busy || loading ? <LoaderCircle size={15} className="animate-spin" /> : <Merge size={15} strokeWidth={2.2} />}
            {busy ? m.merging : m.merge}
          </button>
          {failed && <p className="text-sm text-danger">{m.failed}</p>}
          <button
            type="button"
            className="btn w-full"
            onClick={() => setItems((list) => [...list].sort((a, b) => a.file.name.localeCompare(b.file.name, undefined, { numeric: true, sensitivity: 'base' })))}
          >
            <ArrowDownAZ size={15} strokeWidth={2.2} />
            {m.sortByName}
          </button>
          <button type="button" className="btn w-full" onClick={() => setItems([])}>
            {t.common.reset}
          </button>
        </div>
        <p className="border-t border-line pt-4 text-xs text-muted">
          <Rich text={m.rangeHelp} />
        </p>
      </aside>

      <section className="min-w-0 space-y-3">
        <DropZone onFiles={add} accept="application/pdf,.pdf" compact />
        <ol className="space-y-2">
          {items.map((i, idx) => {
            const r = i.info ? parseRanges(i.range, i.info.pages) : null;
            const err = r && 'error' in r ? r.error : null;
            return (
              <li
                key={i.id}
                draggable
                onDragStart={(e) => {
                  setDragging(idx);
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragOver={(e) => {
                  if (dragging === null) return;
                  e.preventDefault();
                  if (dragging !== idx) {
                    move(dragging, idx);
                    setDragging(idx);
                  }
                }}
                onDragEnd={() => setDragging(null)}
                className={`panel flex items-center gap-3 p-2 pr-1.5 transition ${dragging === idx ? 'opacity-50' : ''}`}
              >
                <GripVertical size={16} className="shrink-0 cursor-grab text-muted" aria-hidden />
                <span className="grid h-16 w-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-panel-2">
                  {i.thumb ? <img src={i.thumb} alt="" className="size-full object-contain" /> : !i.error && <LoaderCircle size={15} className="animate-spin text-muted" />}
                </span>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex min-w-0 items-baseline gap-2">
                    <span className="font-mono text-xs text-muted">{idx + 1}</span>
                    <span className="truncate text-sm" title={i.file.name}>
                      {i.file.name}
                    </span>
                  </div>
                  {i.error ? (
                    <p className="text-xs text-danger">{m.errors[i.error]}</p>
                  ) : i.info ? (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <input
                        className={`input h-8 w-40 text-[13px] ${err ? 'ring-2 ring-danger/50' : ''}`}
                        value={i.range}
                        onChange={(e) => update(i.id, { range: e.target.value })}
                        placeholder={m.allPages(i.info.pages)}
                        aria-label={m.pagesOf(i.file.name)}
                        aria-invalid={!!err}
                      />
                      <span className={`text-xs ${err ? 'text-danger' : 'text-muted'}`}>
                        {err ? m.rangeErrors[err.code](err.token) : `${m.pageCount(r && 'pages' in r ? r.pages.length : 0)} · ${formatBytes(i.file.size)}`}
                      </span>
                    </div>
                  ) : (
                    <p className="text-xs text-muted">{m.reading}</p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col">
                  <button type="button" className="grid size-7 place-items-center rounded-full text-muted hover:bg-panel-2 hover:text-fg disabled:opacity-30" title={m.up} aria-label={m.up} disabled={idx === 0} onClick={() => move(idx, idx - 1)}>
                    <ArrowUp size={14} />
                  </button>
                  <button
                    type="button"
                    className="grid size-7 place-items-center rounded-full text-muted hover:bg-panel-2 hover:text-fg disabled:opacity-30"
                    title={m.down}
                    aria-label={m.down}
                    disabled={idx === items.length - 1}
                    onClick={() => move(idx, idx + 1)}
                  >
                    <ArrowDown size={14} />
                  </button>
                </div>
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
            );
          })}
        </ol>
      </section>
    </div>
  );
}

export default withI18n(PdfMerge);
