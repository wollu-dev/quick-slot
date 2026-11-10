import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, Loader2, X, XCircle } from 'lucide-react';
import DropZone from '../../components/ui/DropZone';
import Segmented from '../../components/ui/Segmented';
import Select from '../../components/ui/Select';
import { useT, withI18n, type Dict } from '../../i18n';
import Rich from '../../i18n/Rich';
import { dedupeNames, downloadBlob, formatBytes, makeZip, splitName, timestampForFilename } from '../../lib/files';
import {
  DataError,
  FORMATS,
  TARGETS,
  canConvert,
  convertFile,
  detectFile,
  formatByExt,
  needsMediaEngine,
  type ConvertResult,
  type FormatId,
  type Kind,
  type MediaQuality,
} from '../../lib/convert';

type Status = 'detecting' | 'pending' | 'working' | 'done' | 'error' | 'unsupported';

interface Row {
  id: number;
  file: File;
  source: FormatId | null;
  status: Status;
  progress: number;
  result?: ConvertResult;
  error?: string;
}

const DEFAULT_TARGETS: Record<Kind, FormatId> = { image: 'jpeg', audio: 'mp3', video: 'mp4', data: 'json' };
const LOSSY: FormatId[] = ['jpeg', 'webp', 'avif'];
const OPAQUE: FormatId[] = ['jpeg', 'bmp'];
const KIND_ORDER: Kind[] = ['image', 'audio', 'video', 'data'];

function errorText(t: Dict, e: unknown): string {
  const errs = t.converter.errors;
  const code = e instanceof DataError ? e.code : e instanceof Error ? e.message : '';
  return code in errs ? errs[code as keyof typeof errs] : errs.unknown;
}

let nextId = 1;

function FileConverter() {
  const t = useT();
  const c = t.converter;
  const [rows, setRows] = useState<Row[]>([]);
  const [targets, setTargets] = useState(DEFAULT_TARGETS);
  const [quality, setQuality] = useState(0.9);
  const [background, setBackground] = useState('#ffffff');
  const [media, setMedia] = useState<MediaQuality>('balanced');
  const [running, setRunning] = useState(false);
  const [engine, setEngine] = useState<number | null>(null);
  const [busyZip, setBusyZip] = useState(false);
  const runId = useRef(0);

  const patch = (id: number, p: Partial<Row>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));

  const addFiles = (files: File[]) => {
    const added = files.map((file) => ({ id: nextId++, file, source: null, status: 'detecting' as Status, progress: 0 }));
    setRows((rs) => [...rs, ...added]);
    for (const row of added) {
      detectFile(row.file).then((source) => patch(row.id, { source, status: source ? 'pending' : 'unsupported' }));
    }
  };

  const targetOf = (source: FormatId) => targets[FORMATS[source].kind];

  // Changing a target or an option invalidates finished results
  useEffect(() => {
    setRows((rs) => rs.map((r) => (r.status === 'done' || r.status === 'error' ? { ...r, status: 'pending', result: undefined, error: undefined, progress: 0 } : r)));
  }, [targets, quality, background, media]);

  const kinds = useMemo(() => KIND_ORDER.filter((k) => rows.some((r) => r.source && FORMATS[r.source].kind === k)), [rows]);
  const convertible = rows.filter((r) => r.source && canConvert(r.source, targetOf(r.source)));
  const pending = convertible.filter((r) => r.status === 'pending');
  const done = rows.filter((r) => r.status === 'done' && r.result);
  const hasMedia = kinds.includes('audio') || kinds.includes('video');
  const imageTarget = kinds.includes('image') ? targets.image : null;

  const run = async () => {
    const id = ++runId.current;
    setRunning(true);
    try {
      for (const row of pending) {
        if (runId.current !== id) return; // reset while running
        const source = row.source!;
        const target = targetOf(source);
        patch(row.id, { status: 'working', progress: 0, error: undefined });
        try {
          const result = await convertFile(
            row.file,
            source,
            target,
            { image: { quality, background }, media },
            (p) => patch(row.id, { progress: p }),
            needsMediaEngine(source, target) ? (p) => setEngine(p < 1 ? p : null) : undefined,
          );
          patch(row.id, { status: 'done', progress: 1, result });
        } catch (e) {
          patch(row.id, { status: 'error', error: errorText(t, e) });
        } finally {
          setEngine(null);
        }
      }
    } finally {
      if (runId.current === id) setRunning(false);
    }
  };

  const download = async () => {
    if (done.length === 1) {
      downloadBlob(done[0].result!.blob, done[0].result!.name);
      return;
    }
    setBusyZip(true);
    try {
      const names = dedupeNames(done.map((r) => r.result!.name));
      const entries = await Promise.all(done.map(async (r, i) => ({ name: names[i], data: new Uint8Array(await r.result!.blob.arrayBuffer()) })));
      downloadBlob(makeZip(entries), `quickslot-converted-${timestampForFilename()}.zip`);
    } finally {
      setBusyZip(false);
    }
  };

  const reset = () => {
    runId.current++;
    setRows([]);
    setRunning(false);
    setEngine(null);
  };

  if (!rows.length) {
    return (
      <div className="space-y-4">
        <DropZone onFiles={addFiles} hint={c.dropHint} />
        <p className="text-sm text-muted">
          <Rich text={c.intro} />
        </p>
      </div>
    );
  }

  const workingCount = rows.filter((r) => r.status === 'done' || r.status === 'error').length;

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <aside className="panel space-y-4 self-start p-4">
        {kinds.length > 0 && (
          <div className="space-y-2">
            <span className="label">{c.convertTo}</span>
            {kinds.map((kind) => (
              <div key={kind} className="flex items-center justify-between gap-3">
                <span className="text-sm">{c.kinds[kind]}</span>
                <Select<FormatId>
                  id={`target-${kind}`}
                  label={`${c.kinds[kind]}: ${c.convertTo}`}
                  className="w-auto min-w-40"
                  value={targets[kind]}
                  onChange={(v) => setTargets((ts) => ({ ...ts, [kind]: v }))}
                  options={TARGETS[kind].map((id) => [id, kind === 'video' && FORMATS[id].kind === 'audio' ? c.audioOnly(FORMATS[id].label) : FORMATS[id].label] as const)}
                />
              </div>
            ))}
          </div>
        )}

        {imageTarget && LOSSY.includes(imageTarget) && (
          <div>
            <label className="label flex justify-between" htmlFor="quality">
              <span>{c.quality}</span>
              <span className="tabular-nums">{Math.round(quality * 100)}%</span>
            </label>
            <input id="quality" type="range" min={0.4} max={1} step={0.05} value={quality} onChange={(e) => setQuality(Number(e.target.value))} className="w-full accent-accent" />
          </div>
        )}

        {imageTarget && OPAQUE.includes(imageTarget) && (
          <div>
            <label className="label" htmlFor="background">
              {c.background}
            </label>
            <div className="flex items-center gap-2">
              <input id="background" type="color" value={background} onChange={(e) => setBackground(e.target.value)} className="h-9 w-12 cursor-pointer rounded-[10px] border border-line bg-panel-2 p-1" />
              <p className="text-xs text-muted">{c.backgroundNote}</p>
            </div>
          </div>
        )}

        {hasMedia && (
          <div className="space-y-2">
            <span className="label">{c.mediaQuality}</span>
            <Segmented
              label={c.mediaQuality}
              value={media}
              onChange={setMedia}
              options={[
                ['high', c.high],
                ['balanced', c.balanced],
                ['small', c.small],
              ]}
            />
            <p className="text-xs leading-relaxed text-muted">{c.engineNote}</p>
          </div>
        )}

        {engine !== null && (
          <div className="space-y-1">
            <p className="text-xs text-muted">{c.engine(Math.round(engine * 100))}</p>
            <div className="h-1.5 overflow-hidden rounded-full bg-panel-2">
              <div className="h-full bg-accent transition-all" style={{ width: `${engine * 100}%` }} />
            </div>
          </div>
        )}

        <div className="space-y-2 border-t border-line pt-4">
          {pending.length > 0 || running ? (
            <button type="button" className="btn btn-primary w-full" disabled={running || !pending.length} onClick={run}>
              {running ? c.converting(workingCount, workingCount + pending.length) : c.convert(pending.length)}
            </button>
          ) : (
            <button type="button" className="btn btn-primary w-full" disabled={!done.length || busyZip} onClick={download}>
              {busyZip ? t.common.working : done.length === 1 ? c.downloadOne : t.common.zipDownload(done.length)}
            </button>
          )}
          {pending.length > 0 && done.length > 0 && !running && (
            <button type="button" className="btn w-full" disabled={busyZip} onClick={download}>
              {done.length === 1 ? c.downloadOne : t.common.zipDownload(done.length)}
            </button>
          )}
          <button type="button" className="btn w-full" onClick={reset}>
            {t.common.reset}
          </button>
        </div>
      </aside>

      <section className="space-y-3">
        <DropZone onFiles={addFiles} compact />
        <ul className="panel divide-y divide-line overflow-hidden">
          {rows.map((r) => (
            <RowItem key={r.id} row={r} target={r.source ? targetOf(r.source) : null} onRemove={() => setRows((rs) => rs.filter((x) => x.id !== r.id))} />
          ))}
        </ul>
      </section>
    </div>
  );
}

function RowItem({ row, target, onRemove }: { row: Row; target: FormatId | null; onRemove: () => void }) {
  const t = useT();
  const c = t.converter;
  const { base, ext } = splitName(row.file.name);
  const extFormat = ext ? formatByExt(ext) : undefined;
  const mismatch = row.source && ext && extFormat?.id !== row.source && !(row.source === 'opus' && extFormat?.id === 'ogg');
  const outName = target ? `${base}.${FORMATS[target].exts[0]}` : '';

  return (
    <li className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3">
      <div className="min-w-0 space-y-0.5">
        <div className="flex min-w-0 items-center gap-2 font-mono text-[13px]">
          <span className="truncate" title={row.file.name}>
            {row.file.name}
          </span>
          {target && row.status !== 'unsupported' && (
            <>
              <ArrowRight size={13} className="shrink-0 text-muted" />
              <span className="truncate text-accent" title={outName}>
                {outName}
              </span>
            </>
          )}
        </div>
        <div className="text-[12px] text-muted">
          {row.status === 'unsupported' ? (
            <span className="text-danger">{c.unsupported}</span>
          ) : row.source ? (
            mismatch ? (
              <span className="inline-flex items-center gap-1 text-[color-mix(in_srgb,var(--danger)_80%,var(--fg))]">
                <AlertTriangle size={12} /> {c.mismatch(ext, FORMATS[row.source].label)}
              </span>
            ) : (
              c.detected(FORMATS[row.source].label)
            )
          ) : null}
          {row.error && <span className="ml-2 text-danger">{row.error}</span>}
        </div>
        {row.status === 'working' && (
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-panel-2">
            <div className="h-full bg-accent transition-all" style={{ width: `${Math.max(4, row.progress * 100)}%` }} />
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <StatusBadge row={row} />
        <button
          type="button"
          className="grid size-6 place-items-center rounded-full text-muted transition hover:bg-danger/10 hover:text-danger"
          aria-label={t.common.removeFromList}
          onClick={onRemove}
        >
          <X size={14} strokeWidth={2.4} />
        </button>
      </div>
    </li>
  );
}

function StatusBadge({ row }: { row: Row }) {
  const s = useT().converter.status;
  if (row.status === 'detecting' || row.status === 'unsupported') return null;
  if (row.status === 'working')
    return (
      <span className="inline-flex items-center gap-1 text-[12px] text-accent">
        <Loader2 size={13} className="animate-spin" /> {s.working}
      </span>
    );
  if (row.status === 'error')
    return (
      <span className="inline-flex items-center gap-1 text-[12px] text-danger">
        <XCircle size={13} /> {s.error}
      </span>
    );
  if (row.status === 'done' && row.result)
    return (
      <span className="inline-flex items-center gap-1 text-[12px] text-ok" title={row.result.renamed ? s.renamed : undefined}>
        <CheckCircle2 size={13} /> {row.result.renamed ? s.renamed : `${s.done} · ${formatBytes(row.result.blob.size)}`}
      </span>
    );
  return <span className="text-[12px] text-muted">{s.pending}</span>;
}

export default withI18n(FileConverter);
