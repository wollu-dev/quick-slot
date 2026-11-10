import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import DropZone from '../../components/ui/DropZone';
import Select from '../../components/ui/Select';
import { LANG_TAGS, useLang, useT, withI18n, type Dict } from '../../i18n';
import Rich from '../../i18n/Rich';
import { dedupeNames, downloadBlob, formatBytes, makeZip, readBytes, splitName, timestampForFilename } from '../../lib/files';
import NumberField from '../../components/ui/NumberField';

type CaseMode = 'none' | 'lower' | 'upper';

interface Options {
  find: string;
  replace: string;
  useRegex: boolean;
  ignoreCase: boolean;
  pattern: string;
  start: number;
  pad: number;
  caseMode: CaseMode;
  spaceToUnderscore: boolean;
  extLower: boolean;
}

const DEFAULTS: Options = {
  find: '',
  replace: '',
  useRegex: false,
  ignoreCase: false,
  pattern: '{name}',
  start: 1,
  pad: 3,
  caseMode: 'none',
  spaceToUnderscore: false,
  extLower: false,
};

function buildName(file: File, index: number, o: Options, t: Dict): { name: string; error?: string } {
  const { base, ext } = splitName(file.name);

  let b = base;
  if (o.find) {
    try {
      const re = o.useRegex
        ? new RegExp(o.find, o.ignoreCase ? 'gi' : 'g')
        : new RegExp(o.find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), o.ignoreCase ? 'gi' : 'g');
      b = b.replace(re, o.replace);
    } catch (e) {
      return { name: file.name, error: t.rename.regexError((e as Error).message) };
    }
  }
  const n = String(o.start + index).padStart(Math.max(0, o.pad), '0');
  b = (o.pattern || '{name}').replaceAll('{name}', b).replaceAll('{n}', n);
  if (o.caseMode === 'lower') b = b.toLowerCase();
  if (o.caseMode === 'upper') b = b.toUpperCase();
  if (o.spaceToUnderscore) b = b.replace(/\s+/g, '_');
  const e = o.extLower ? ext.toLowerCase() : ext;
  return { name: e ? `${b}.${e}` : b };
}

const INVALID = /[\\/:*?"<>|]/;

function BatchRename() {
  const t = useT();
  const lang = useLang();
  const [files, setFiles] = useState<File[]>([]);
  const [o, setO] = useState<Options>(DEFAULTS);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Options>(k: K, v: Options[K]) => setO((prev) => ({ ...prev, [k]: v }));

  const rows = useMemo(() => {
    const built = files.map((f, i) => buildName(f, i, o, t));
    const finalNames = dedupeNames(built.map((b) => b.name));
    return files.map((file, i) => ({
      file,
      next: finalNames[i],
      deduped: finalNames[i] !== built[i].name,
      error: built[i].error ?? (INVALID.test(built[i].name) ? t.rename.invalidChars : !built[i].name.trim() ? t.rename.emptyName : undefined),
    }));
  }, [files, o, t]);

  const changed = rows.filter((r) => r.next !== r.file.name).length;
  const hasError = rows.some((r) => r.error);

  const addFiles = (incoming: File[]) =>
    setFiles((prev) => [...prev, ...incoming].sort((a, b) => a.name.localeCompare(b.name, LANG_TAGS[lang], { numeric: true })));

  const download = async () => {
    setBusy(true);
    try {
      if (rows.length === 1) {
        downloadBlob(rows[0].file, rows[0].next);
      } else {
        const entries = await Promise.all(
          rows.map(async (r) => ({ name: r.next, data: await readBytes(r.file), mtime: new Date(r.file.lastModified) })),
        );
        downloadBlob(makeZip(entries), `quickslot-rename-${timestampForFilename()}.zip`);
      }
    } finally {
      setBusy(false);
    }
  };

  if (!files.length) {
    return <DropZone onFiles={addFiles} hint={t.rename.dropHint} />;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <aside className="panel space-y-4 self-start p-4">
          <div>
            <label className="label" htmlFor="find">{t.rename.find}</label>
            <input id="find" className="input font-mono" value={o.find} onChange={(e) => set('find', e.target.value)} />
            <div className="mt-1.5 flex gap-3 text-xs text-muted">
              <label className="flex items-center gap-1"><input type="checkbox" checked={o.useRegex} onChange={(e) => set('useRegex', e.target.checked)} /> {t.rename.regex}</label>
              <label className="flex items-center gap-1"><input type="checkbox" checked={o.ignoreCase} onChange={(e) => set('ignoreCase', e.target.checked)} /> {t.rename.ignoreCase}</label>
            </div>
          </div>
          <div>
            <label className="label" htmlFor="replace">{t.rename.replace}</label>
            <input id="replace" className="input font-mono" value={o.replace} onChange={(e) => set('replace', e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="pattern">{t.rename.pattern}</label>
            <input id="pattern" className="input font-mono" value={o.pattern} onChange={(e) => set('pattern', e.target.value)} />
            <p className="mt-1 text-xs text-muted">
              <Rich text={t.rename.patternHelp} codeClassName="font-mono text-fg" />
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label" htmlFor="start">{t.rename.start}</label>
              <NumberField id="start" min={0} value={o.start} onChange={(v) => set('start', v)} />
            </div>
            <div>
              <label className="label" htmlFor="pad">{t.rename.pad}</label>
              <NumberField id="pad" min={0} max={10} value={o.pad} onChange={(v) => set('pad', v)} />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="case">{t.rename.caseLabel}</label>
            <Select
              id="case"
              value={o.caseMode}
              onChange={(v) => set('caseMode', v)}
              options={[
                ['none', t.rename.caseNone],
                ['lower', t.rename.caseLower],
                ['upper', t.rename.caseUpper],
              ]}
            />
          </div>
          <div className="space-y-1.5 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={o.spaceToUnderscore} onChange={(e) => set('spaceToUnderscore', e.target.checked)} /> {t.rename.spaceToUnderscore}</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={o.extLower} onChange={(e) => set('extLower', e.target.checked)} /> {t.rename.extLower}</label>
          </div>

        <div className="space-y-2 border-t border-line pt-4">
          <button type="button" className="btn btn-primary w-full" disabled={busy || hasError || changed === 0} onClick={download}>
            {busy ? t.common.working : rows.length === 1 ? t.rename.downloadOne : t.rename.downloadZip(changed)}
          </button>
          <button type="button" className="btn w-full" onClick={() => setFiles([])}>{t.common.reset}</button>
          {rows.length > 1 && <p className="text-xs text-muted">{t.rename.keepDates}</p>}
        </div>
      </aside>

      <section className="space-y-3">
        <DropZone onFiles={addFiles} compact />
        <div className="panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-4 py-2 text-xs text-muted">
            <span>{t.rename.summary(rows.length, changed)}</span>
          </div>
          <ul className="max-h-[60vh] divide-y divide-line overflow-y-auto text-sm">
            {rows.map((r, i) => (
              <li key={i} className="grid grid-cols-[1fr_auto] items-center gap-2 px-4 py-2">
                <div className="min-w-0 font-mono text-[13px]">
                  <div className="truncate text-muted" title={r.file.name}>{r.file.name}</div>
                  <div className={`truncate ${r.error ? 'text-danger' : r.next !== r.file.name ? 'text-accent' : 'text-muted/60'}`} title={r.next}>
                    → {r.next}
                    {r.deduped && <span className="ml-2 font-sans text-xs text-muted">{t.rename.deduped}</span>}
                  </div>
                  {r.error && <div className="font-sans text-xs text-danger">{r.error}</div>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted">{formatBytes(r.file.size)}</span>
                  <button type="button" className="grid size-6 place-items-center rounded-full text-muted transition hover:bg-danger/10 hover:text-danger" aria-label={t.common.removeFromList} onClick={() => setFiles((p) => p.filter((_, j) => j !== i))}>
                    <X size={14} strokeWidth={2.4} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}

export default withI18n(BatchRename);
