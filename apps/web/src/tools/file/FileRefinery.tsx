import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Download, LoaderCircle, X } from 'lucide-react';
import CopyButton from '../../components/ui/CopyButton';
import DateTimePicker, { toDateTimeValue } from '../../components/ui/DateTimePicker';
import DropZone, { filePath } from '../../components/ui/DropZone';
import Segmented from '../../components/ui/Segmented';
import Select from '../../components/ui/Select';
import { LANG_TAGS, useLang, useT, withI18n } from '../../i18n';
import Rich from '../../i18n/Rich';
import { FORMATS, TARGETS, type FormatId, type Kind } from '../../lib/convert';
import { downloadBlob, makeZip, timestampForFilename } from '../../lib/files';
import { needsNfc } from '../../lib/normalize';
import { checksums, inspect, plan, produce, type DateMode, type RefineOptions, type Source } from '../../lib/refinery';
import { INVALID_NAME, RENAME_DEFAULTS } from '../../lib/rename';

/** One switchable step of the pipeline */
function Step({ title, note, on, onToggle, children }: { title: string; note: string; on: boolean; onToggle: (v: boolean) => void; children?: React.ReactNode }) {
  return (
    <div className="space-y-2 border-t border-line pt-3 first:border-t-0 first:pt-0">
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-1" checked={on} onChange={(e) => onToggle(e.target.checked)} />
        <span>
          <span className="font-medium">{title}</span>
          <span className="block text-xs text-muted">{note}</span>
        </span>
      </label>
      {on && children && <div className="space-y-2 pl-1">{children}</div>}
    </div>
  );
}

function FileRefinery() {
  const t = useT();
  const r = t.refinery;
  const lang = useLang();
  const [sources, setSources] = useState<Source[]>([]);
  const [o, setO] = useState<RefineOptions>({
    convert: { enabled: false, targets: {}, opts: { image: { quality: 0.9, background: '#ffffff' }, media: 'balanced' } },
    strip: true,
    rename: { enabled: false, opts: { ...RENAME_DEFAULTS, pattern: '{date}_{n}' } },
    nfc: true,
    date: { mode: 'keep', value: new Date(), created: true },
    hash: true,
  });
  const [run, setRun] = useState<{ done: number; total: number; engine?: number } | null>(null);
  const [result, setResult] = useState<{ sums: string; count: number } | null>(null);
  const [failed, setFailed] = useState<string[]>([]);
  const alive = useRef(true);
  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );

  const add = async (files: File[]) => {
    setResult(null);
    const found = await Promise.all(files.map((f) => inspect(f, filePath(f))));
    setSources((list) => [...list, ...found].sort((a, b) => (a.folder + a.file.name).localeCompare(b.folder + b.file.name, LANG_TAGS[lang], { numeric: true })));
  };

  const planned = useMemo(() => plan(sources, o), [sources, o]);
  const kinds = [...new Set(sources.map((s) => (s.format ? FORMATS[s.format].kind : null)).filter(Boolean))] as Kind[];
  const badName = planned.some((p) => p.regexError || INVALID_NAME.test(p.path.split('/').pop() ?? ''));
  const set = (patch: Partial<RefineOptions>) => {
    setResult(null);
    setO((x) => ({ ...x, ...patch }));
  };

  const go = async () => {
    setRun({ done: 0, total: planned.length });
    setResult(null);
    const out: { path: string; data: Uint8Array; mtime: Date; ctime?: Date }[] = [];
    const errors: string[] = [];
    for (const p of planned) {
      try {
        const data = await produce(p, o, undefined, (e) => alive.current && setRun((s) => s && { ...s, engine: e }));
        out.push({ path: p.path, data, mtime: p.mtime, ctime: p.ctime });
      } catch {
        errors.push(p.source.folder + p.source.file.name);
      }
      if (!alive.current) return;
      setRun((s) => s && { ...s, done: s.done + 1, engine: undefined });
    }
    const sums = o.hash ? await checksums(out) : '';
    const entries = out.map((f) => ({ name: f.path, data: f.data, mtime: f.mtime, ctime: f.ctime }));
    if (o.hash) entries.push({ name: 'SHA256SUMS.txt', data: new TextEncoder().encode(sums), mtime: new Date(), ctime: undefined });
    downloadBlob(makeZip(entries), `quickslot-refined-${timestampForFilename()}.zip`);
    setFailed(errors);
    setResult({ sums, count: out.length });
    setRun(null);
  };

  const fmtDate = (d: Date) => d.toLocaleString(LANG_TAGS[lang], { dateStyle: 'medium', timeStyle: 'short' });

  if (!sources.length) {
    return (
      <div className="space-y-4">
        <DropZone onFiles={add} hint={r.dropHint} />
        <p className="text-sm text-muted">
          <Rich text={r.intro} />
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
      <aside className="panel min-w-0 space-y-3 self-start p-4">
        <Step title={r.steps.convert} note={r.notes.convert} on={o.convert.enabled} onToggle={(v) => set({ convert: { ...o.convert, enabled: v } })}>
          {kinds.map((k) => (
            <div key={k} className="flex items-center justify-between gap-2">
              <span className="text-sm">{t.converter.kinds[k]}</span>
              <Select<FormatId | 'keep'>
                id={`rf-${k}`}
                className="w-auto min-w-36"
                value={o.convert.targets[k] ?? 'keep'}
                onChange={(v) => set({ convert: { ...o.convert, targets: { ...o.convert.targets, [k]: v === 'keep' ? undefined : v } } })}
                options={[['keep', r.keep] as const, ...TARGETS[k].filter((id) => FORMATS[id].kind === k).map((id) => [id, FORMATS[id].label] as const)]}
              />
            </div>
          ))}
        </Step>

        <Step title={r.steps.strip} note={r.notes.strip} on={o.strip} onToggle={(v) => set({ strip: v })} />

        <Step title={r.steps.rename} note={r.notes.rename} on={o.rename.enabled} onToggle={(v) => set({ rename: { ...o.rename, enabled: v } })}>
          <input
            className="input w-full font-mono text-[13px]"
            value={o.rename.opts.pattern}
            onChange={(e) => set({ rename: { ...o.rename, opts: { ...o.rename.opts, pattern: e.target.value } } })}
            aria-label={r.pattern}
          />
          <p className="text-xs text-muted">
            <Rich text={r.patternHelp} />
          </p>
          <div className="grid grid-cols-2 gap-2">
            <input
              className="input min-w-0 text-[13px]"
              value={o.rename.opts.find}
              placeholder={t.rename.find}
              aria-label={t.rename.find}
              onChange={(e) => set({ rename: { ...o.rename, opts: { ...o.rename.opts, find: e.target.value } } })}
            />
            <input
              className="input min-w-0 text-[13px]"
              value={o.rename.opts.replace}
              placeholder={t.rename.replace}
              aria-label={t.rename.replace}
              onChange={(e) => set({ rename: { ...o.rename, opts: { ...o.rename.opts, replace: e.target.value } } })}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={o.rename.opts.spaceToUnderscore} onChange={(e) => set({ rename: { ...o.rename, opts: { ...o.rename.opts, spaceToUnderscore: e.target.checked } } })} />
            {r.spaces}
          </label>
        </Step>

        <Step title={r.steps.nfc} note={r.notes.nfc} on={o.nfc} onToggle={(v) => set({ nfc: v })} />

        <Step title={r.steps.date} note={r.notes.date} on={o.date.mode !== 'keep'} onToggle={(v) => set({ date: { ...o.date, mode: v ? 'exif' : 'keep' } })}>
          <Segmented
            label={r.steps.date}
            value={o.date.mode === 'keep' ? 'exif' : o.date.mode}
            onChange={(mode: Exclude<DateMode, 'keep'>) => set({ date: { ...o.date, mode } })}
            options={[
              ['exif', r.dateExif],
              ['set', r.dateSet],
            ]}
          />
          {o.date.mode === 'set' && <DateTimePicker id="rf-date" label={r.dateSet} value={toDateTimeValue(o.date.value)} onChange={(v) => set({ date: { ...o.date, value: new Date(v) } })} />}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={o.date.created} onChange={(e) => set({ date: { ...o.date, created: e.target.checked } })} />
            {r.alsoCreated}
          </label>
        </Step>

        <Step title={r.steps.hash} note={r.notes.hash} on={o.hash} onToggle={(v) => set({ hash: v })} />

        <div className="space-y-2 border-t border-line pt-3">
          {run ? (
            <div className="space-y-1" role="progressbar" aria-valuemin={0} aria-valuemax={run.total} aria-valuenow={run.done}>
              <div className="h-1.5 overflow-hidden rounded-full bg-panel-2">
                <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${(run.done / run.total) * 100}%` }} />
              </div>
              <p className="text-xs text-muted">{run.engine !== undefined ? t.videoGif.downloading : r.working(run.done, run.total)}</p>
            </div>
          ) : (
            <button type="button" className="btn btn-primary w-full" disabled={badName} onClick={go}>
              {run ? <LoaderCircle size={15} className="animate-spin" /> : <Download size={15} strokeWidth={2.2} />}
              {r.go(planned.length)}
            </button>
          )}
          {badName && <p className="text-xs text-danger">{t.rename.invalidChars}</p>}
          <button
            type="button"
            className="btn w-full"
            disabled={!!run}
            onClick={() => {
              setSources([]);
              setResult(null);
            }}
          >
            {t.common.reset}
          </button>
        </div>
      </aside>

      <section className="min-w-0 space-y-3">
        {result && (
          <div className="panel space-y-2 p-4" aria-live="polite">
            <p className="text-sm font-medium text-ok">{r.done(result.count)}</p>
            {failed.length > 0 && <p className="text-sm text-danger">{r.failed(failed.join(', '))}</p>}
            {result.sums && (
              <>
                <div className="flex items-center justify-between gap-2">
                  <span className="label">SHA256SUMS.txt</span>
                  <CopyButton text={result.sums} />
                </div>
                <pre className="max-h-48 overflow-auto rounded-xl bg-panel-2 p-3 font-mono text-[11px] leading-relaxed">{result.sums}</pre>
              </>
            )}
          </div>
        )}
        <DropZone onFiles={add} compact />
        <ul className="panel divide-y divide-line">
          {planned.map((p, i) => {
            const from = p.source.folder + p.source.file.name;
            return (
              <li key={i} className="flex items-start gap-3 py-2.5 pr-1.5 pl-4">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="flex min-w-0 flex-wrap items-center gap-x-2 text-sm">
                    <span className="min-w-0 break-all text-muted">{from}</span>
                    {p.path !== from && (
                      <>
                        <ArrowRight size={13} className="shrink-0 text-muted" aria-hidden />
                        <span className="min-w-0 break-all font-medium">{p.path}</span>
                      </>
                    )}
                  </p>
                  <p className="flex flex-wrap gap-1.5 text-[11px]">
                    {p.target && p.source.format && (
                      <span className="rounded-full bg-accent/12 px-2 py-0.5 text-accent">
                        {FORMATS[p.source.format].label} → {FORMATS[p.target].label}
                      </span>
                    )}
                    {p.strip && <span className="rounded-full bg-panel-2 px-2 py-0.5 text-muted">{r.badges.strip}</span>}
                    {o.nfc && needsNfc(from) && <span className="rounded-full bg-panel-2 px-2 py-0.5 text-muted">NFC</span>}
                    {o.date.mode !== 'keep' && <span className="rounded-full bg-panel-2 px-2 py-0.5 text-muted">{fmtDate(p.mtime)}</span>}
                    {o.date.mode === 'exif' && !p.source.taken && <span className="rounded-full bg-panel-2 px-2 py-0.5 text-muted">{r.badges.noExif}</span>}
                    {!p.source.format && <span className="rounded-full bg-panel-2 px-2 py-0.5 text-muted">{r.badges.unknown}</span>}
                  </p>
                  {p.regexError && <p className="text-xs text-danger">{t.rename.regexError(p.regexError)}</p>}
                </div>
                <button
                  type="button"
                  className="grid size-8 shrink-0 place-items-center rounded-full text-muted hover:bg-panel-2 hover:text-fg"
                  title={t.common.removeFromList}
                  aria-label={t.common.removeFromList}
                  disabled={!!run}
                  onClick={() => setSources((list) => list.filter((s) => s !== p.source))}
                >
                  <X size={15} strokeWidth={2.2} />
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

export default withI18n(FileRefinery);
