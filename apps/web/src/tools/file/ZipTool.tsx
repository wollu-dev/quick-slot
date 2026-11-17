import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Download, File as FileIcon, FolderOpen, FolderPlus, Lock, X } from 'lucide-react';
import DropZone, { filePath } from '../../components/ui/DropZone';
import Segmented from '../../components/ui/Segmented';
import Select from '../../components/ui/Select';
import { LANG_TAGS, useLang, useT, withI18n, type Dict } from '../../i18n';
import Rich from '../../i18n/Rich';
import { downloadBlob, formatBytes, splitName } from '../../lib/files';
import {
  ArchiveError,
  detectEncoding,
  entryName,
  entryProblem,
  extractEntry,
  hasLegacyNames,
  isJunk,
  MAX_ZIP_BYTES,
  NAME_ENCODINGS,
  openArchive,
  safePath,
  writeZip,
  type Archive,
  type ArchiveEntry,
  type ArchiveErrorCode,
  type EntryProblem,
  type Level,
  type NameEncoding,
} from '../../lib/archive';

type Mode = 'compress' | 'extract';

/** Rows past this are summarized, so huge archives don't render thousands of rows */
const MAX_ROWS = 300;

const isZipName = (name: string) => /\.zip$/i.test(name);

function ZipTool() {
  const t = useT();
  const z = t.zip;
  const [mode, setMode] = useState<Mode>('compress');
  const [dropped, setDropped] = useState<File | null>(null);

  return (
    <div className="space-y-4">
      <Segmented
        label={z.mode}
        value={mode}
        onChange={setMode}
        options={[
          ['compress', z.compress],
          ['extract', z.extract],
        ]}
      />
      {mode === 'compress' ? (
        <Compress
          onOpenZip={(f) => {
            setDropped(f);
            setMode('extract');
          }}
        />
      ) : (
        <Extract initial={dropped} onConsumed={() => setDropped(null)} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Compress                                                            */
/* ------------------------------------------------------------------ */

interface Item {
  id: number;
  file: File;
  path: string;
}
let nextId = 1;

function defaultName(items: Item[]): string {
  const tops = new Set(items.map((i) => (i.path.includes('/') ? i.path.split('/')[0] : '')));
  if (tops.size === 1 && !tops.has('')) return [...tops][0];
  if (items.length === 1) return splitName(items[0].file.name).base;
  return 'archive';
}

function Compress({ onOpenZip }: { onOpenZip: (f: File) => void }) {
  const t = useT();
  const z = t.zip;
  const [items, setItems] = useState<Item[]>([]);
  const [name, setName] = useState('');
  const [level, setLevel] = useState<Level>(6);
  const [skipJunk, setSkipJunk] = useState(true);
  const [progress, setProgress] = useState<number | null>(null);
  const [result, setResult] = useState<{ before: number; after: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const folderInput = useRef<HTMLInputElement>(null);
  const alive = useRef(true);
  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );

  const add = (files: File[]) => {
    const added = files.map((file) => ({ id: nextId++, file, path: safePath(filePath(file)) || file.name }));
    if (!items.length) setName(defaultName(added));
    // A file at the same path replaces the earlier one
    const paths = new Set(added.map((a) => a.path));
    setItems((list) => [...list.filter((i) => !paths.has(i.path)), ...added]);
    setResult(null);
  };

  const included = skipJunk ? items.filter((i) => !isJunk(i.path)) : items;
  const skipped = items.length - included.length;
  const total = included.reduce((n, i) => n + i.file.size, 0);
  const tooBig = total > MAX_ZIP_BYTES;
  const onlyZips = items.length > 0 && items.every((i) => isZipName(i.file.name));

  const make = async () => {
    setProgress(0);
    setResult(null);
    setFailed(false);
    try {
      const blob = await writeZip(
        included.map((i) => ({ path: i.path, data: i.file, mtime: new Date(i.file.lastModified) })),
        level,
        (p) => alive.current && setProgress(p),
        () => alive.current,
      );
      downloadBlob(blob, `${name.trim() || 'archive'}.zip`);
      setResult({ before: total, after: blob.size });
    } catch {
      setFailed(true);
    }
    setProgress(null);
  };

  if (!items.length) {
    return (
      <div className="space-y-4">
        <DropZone onFiles={add} hint={z.compressHint} />
        <FolderPicker label={z.pickFolder} onFiles={add} inputRef={folderInput} />
        <p className="text-sm text-muted">
          <Rich text={z.compressIntro} />
        </p>
      </div>
    );
  }

  const shown = included.slice(0, MAX_ROWS);
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="panel min-w-0 space-y-4 self-start p-4">
        <div className="space-y-2">
          <label className="label" htmlFor="zip-name">
            {z.archiveName}
          </label>
          <div className="flex items-center gap-2">
            <input id="zip-name" className="input min-w-0 flex-1" value={name} onChange={(e) => setName(e.target.value.replace(/[\\/:*?"<>|]/g, ''))} spellCheck={false} />
            <span className="text-sm text-muted">.zip</span>
          </div>
        </div>
        <div className="space-y-2">
          <span className="label block">{z.level}</span>
          <Segmented
            label={z.level}
            value={String(level) as '0' | '6' | '9'}
            onChange={(v) => setLevel(Number(v) as Level)}
            options={[
              ['0', z.levels.store],
              ['6', z.levels.normal],
              ['9', z.levels.max],
            ]}
          />
          <p className="text-xs text-muted">{z.levelNote}</p>
        </div>
        <label className="flex items-start gap-2 border-t border-line pt-4 text-sm">
          <input type="checkbox" className="mt-1" checked={skipJunk} onChange={(e) => setSkipJunk(e.target.checked)} />
          <span>
            {z.skipJunk}
            <span className="block text-xs text-muted">{skipped ? z.skippedCount(skipped) : z.skipJunkNote}</span>
          </span>
        </label>
        <div className="space-y-2 border-t border-line pt-4">
          <p className="text-sm">
            <Rich text={z.summary(included.length, formatBytes(total))} />
          </p>
          {tooBig && <p className="text-sm text-danger">{z.tooBig}</p>}
          {progress !== null ? (
            <Progress value={progress} />
          ) : (
            <button type="button" className="btn btn-primary w-full" disabled={!included.length || tooBig} onClick={make}>
              <Download size={15} strokeWidth={2.2} />
              {z.make}
            </button>
          )}
          {result && (
            <p className="text-sm text-ok" aria-live="polite">
              {z.made(formatBytes(result.before), formatBytes(result.after), Math.max(0, Math.floor((1 - result.after / Math.max(1, result.before)) * 100)))}
            </p>
          )}
          {failed && <p className="text-sm text-danger">{z.makeFailed}</p>}
          <button
            type="button"
            className="btn w-full"
            disabled={progress !== null}
            onClick={() => {
              setItems([]);
              setResult(null);
            }}
          >
            {t.common.reset}
          </button>
        </div>
      </aside>

      <section className="min-w-0 space-y-3">
        {onlyZips && (
          <div className="panel flex flex-wrap items-center gap-3 p-4 text-sm">
            <span className="min-w-0 flex-1">{z.looksLikeZip}</span>
            <button type="button" className="btn btn-tinted" onClick={() => onOpenZip(items[0].file)}>
              {z.openInExtract}
            </button>
          </div>
        )}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
          <DropZone onFiles={add} compact />
          <FolderPicker label={z.addFolder} onFiles={add} inputRef={folderInput} compact />
        </div>
        <ul className="panel divide-y divide-line overflow-hidden">
          {shown.map((i) => (
            <li key={i.id} className="flex items-center gap-3 py-1.5 pr-1.5 pl-4">
              <FileIcon size={15} className="shrink-0 text-muted" />
              <PathText path={i.path} />
              <span className="shrink-0 text-xs text-muted">{formatBytes(i.file.size)}</span>
              <button
                type="button"
                className="grid size-8 shrink-0 place-items-center rounded-full text-muted hover:bg-panel-2 hover:text-fg"
                title={t.common.removeFromList}
                aria-label={t.common.removeFromList}
                disabled={progress !== null}
                onClick={() => setItems((list) => list.filter((x) => x.id !== i.id))}
              >
                <X size={15} strokeWidth={2.2} />
              </button>
            </li>
          ))}
          {included.length > MAX_ROWS && <li className="px-4 py-2.5 text-sm text-muted">{z.more(included.length - MAX_ROWS)}</li>}
        </ul>
      </section>
    </div>
  );
}

/** Picks a whole folder (keeps its structure through webkitRelativePath) */
function FolderPicker({ label, onFiles, inputRef, compact }: { label: string; onFiles: (f: File[]) => void; inputRef: React.RefObject<HTMLInputElement | null>; compact?: boolean }) {
  return (
    <>
      <button type="button" className={`btn ${compact ? 'h-auto min-h-9 rounded-[18px] px-5 py-3.5' : ''}`} onClick={() => inputRef.current?.click()}>
        <FolderPlus size={16} strokeWidth={2.2} />
        {label}
      </button>
      <input
        ref={(el) => {
          inputRef.current = el;
          el?.setAttribute('webkitdirectory', '');
        }}
        type="file"
        hidden
        multiple
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          if (files.length) onFiles(files);
          e.target.value = '';
        }}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Extract                                                             */
/* ------------------------------------------------------------------ */

type DirPicker = (opts?: { mode?: 'readwrite' }) => Promise<FileSystemDirectoryHandle>;
const dirPicker = (): DirPicker | undefined => (typeof window !== 'undefined' ? (window as unknown as { showDirectoryPicker?: DirPicker }).showDirectoryPicker : undefined);

const PREFERRED: Record<string, NameEncoding[]> = {
  ko: ['euc-kr', 'shift_jis', 'gbk', 'big5'],
  ja: ['shift_jis', 'euc-kr', 'gbk', 'big5'],
  en: ['euc-kr', 'shift_jis', 'gbk', 'big5'],
};

function problemLabel(z: Dict['zip'], p: EntryProblem | string) {
  return p === 'encrypted' ? z.problems.encrypted : p === 'method' ? z.problems.method : z.problems.corrupt;
}

function Extract({ initial, onConsumed }: { initial: File | null; onConsumed: () => void }) {
  const t = useT();
  const z = t.zip;
  const lang = useLang();
  const [file, setFile] = useState<File | null>(null);
  const [archive, setArchive] = useState<Archive | null>(null);
  const [error, setError] = useState<ArchiveErrorCode | null>(null);
  const [encoding, setEncoding] = useState<'auto' | NameEncoding>('auto');
  const [hideJunk, setHideJunk] = useState(true);
  const [work, setWork] = useState<{ done: number; total: number } | null>(null);
  const [outcome, setOutcome] = useState<{ kind: 'folder' | 'repack'; ok: number; failed: number; folder?: string } | null>(null);
  const [rowError, setRowError] = useState<Record<number, string>>({});
  const canPickDir = !!dirPicker();

  const load = async (f: File) => {
    setFile(f);
    setArchive(null);
    setError(null);
    setOutcome(null);
    setRowError({});
    setEncoding('auto');
    try {
      setArchive(await openArchive(f));
    } catch (e) {
      setError(e instanceof ArchiveError ? e.code : 'corrupt');
    }
  };

  useEffect(() => {
    if (initial) {
      load(initial);
      onConsumed();
    }
  }, [initial]);

  const detected = useMemo(() => (archive ? detectEncoding(archive.entries, PREFERRED[lang] ?? PREFERRED.en) : 'utf-8'), [archive, lang]);
  const enc = encoding === 'auto' ? detected : encoding;
  const legacy = archive ? hasLegacyNames(archive.entries) : false;

  const rows = useMemo(() => {
    if (!archive) return [];
    return archive.entries
      .map((entry, index) => ({ entry, index, name: entryName(entry, enc) }))
      .filter((r) => !r.entry.isDir && !(hideJunk && isJunk(r.name)));
  }, [archive, enc, hideJunk]);
  const totalSize = rows.reduce((n, r) => n + r.entry.size, 0);
  const blocked = rows.filter((r) => entryProblem(r.entry)).length;
  const base = file ? splitName(file.name).base : 'archive';

  const saveOne = async (r: (typeof rows)[number]) => {
    try {
      const data = await extractEntry(archive!, r.entry);
      downloadBlob(new Blob([data as Uint8Array<ArrayBuffer>]), safePath(r.name).split('/').pop() || 'file');
    } catch (e) {
      setRowError((m) => ({ ...m, [r.index]: (e as Error).message }));
    }
  };

  const toFolder = async () => {
    let root: FileSystemDirectoryHandle;
    try {
      root = await dirPicker()!({ mode: 'readwrite' });
    } catch {
      return; // picker closed
    }
    const target = safePath(base) || 'archive';
    setOutcome(null);
    setWork({ done: 0, total: rows.length });
    let ok = 0;
    let failed = 0;
    const errors: Record<number, string> = {};
    try {
      const top = await root.getDirectoryHandle(target, { create: true });
      for (const r of rows) {
        try {
          const path = safePath(r.name);
          if (!path) throw new Error('corrupt');
          const parts = path.split('/');
          let dir = top;
          for (const p of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(p, { create: true });
          const data = await extractEntry(archive!, r.entry);
          const handle = await dir.getFileHandle(parts.at(-1)!, { create: true });
          const w = await handle.createWritable();
          await w.write(data as Uint8Array<ArrayBuffer>);
          await w.close();
          ok++;
        } catch (e) {
          failed++;
          errors[r.index] = (e as Error).message;
        }
        setWork((w) => w && { ...w, done: w.done + 1 });
      }
    } catch {
      failed = rows.length - ok;
    }
    setRowError(errors);
    setWork(null);
    setOutcome({ kind: 'folder', ok, failed, folder: root.name ? `${root.name}/${target}` : target });
  };

  const repack = async () => {
    setOutcome(null);
    setWork({ done: 0, total: rows.length });
    const items = [];
    const errors: Record<number, string> = {};
    for (const r of rows) {
      try {
        items.push({ path: safePath(r.name), data: await extractEntry(archive!, r.entry), mtime: r.entry.mtime });
      } catch (e) {
        errors[r.index] = (e as Error).message;
      }
      setWork((w) => w && { ...w, done: w.done + 1 });
    }
    try {
      const blob = await writeZip(items, 6);
      downloadBlob(blob, `${base}-utf8.zip`);
    } catch {
      /* counted below */
    }
    setRowError(errors);
    setWork(null);
    setOutcome({ kind: 'repack', ok: items.length, failed: Object.keys(errors).length });
  };

  if (!file) {
    return (
      <div className="space-y-4">
        <DropZone onFiles={(f) => load(f[0])} accept=".zip,application/zip" multiple={false} hint={z.extractHint} />
        <p className="text-sm text-muted">
          <Rich text={z.extractIntro} />
        </p>
      </div>
    );
  }

  const fmtDate = (d?: Date) => (d ? d.toLocaleDateString(LANG_TAGS[lang], { year: 'numeric', month: 'short', day: 'numeric' }) : '');

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="panel min-w-0 space-y-4 self-start p-4">
        <div className="min-w-0">
          <h3 className="truncate font-mono text-sm" title={file.name}>
            {file.name}
          </h3>
          {archive && <p className="mt-1 text-sm text-muted">{z.archiveInfo(rows.length, formatBytes(totalSize), formatBytes(file.size))}</p>}
        </div>

        {archive && (
          <>
            {legacy && (
              <div className="space-y-2 border-t border-line pt-4">
                <label className="label" htmlFor="zip-enc">
                  {z.encoding}
                </label>
                <Select
                  id="zip-enc"
                  value={encoding}
                  onChange={setEncoding}
                  options={[['auto', z.encodingAuto(z.encodings[detected])], ...NAME_ENCODINGS.map((e) => [e, z.encodings[e]] as const)]}
                />
                <p className="text-xs text-muted">{z.encodingNote}</p>
              </div>
            )}
            <label className="flex items-start gap-2 border-t border-line pt-4 text-sm">
              <input type="checkbox" className="mt-1" checked={hideJunk} onChange={(e) => setHideJunk(e.target.checked)} />
              <span>
                {z.hideJunk}
                <span className="block text-xs text-muted">{z.skipJunkNote}</span>
              </span>
            </label>
            {blocked > 0 && (
              <p className="flex items-start gap-1.5 text-sm text-danger">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                {z.blocked(blocked)}
              </p>
            )}
            <div className="space-y-2 border-t border-line pt-4">
              {work ? (
                <Progress value={work.done / Math.max(1, work.total)} label={`${work.done} / ${work.total}`} />
              ) : (
                <>
                  {canPickDir ? (
                    <>
                      <button type="button" className="btn btn-primary w-full" disabled={!rows.length} onClick={toFolder}>
                        <FolderOpen size={15} strokeWidth={2.2} />
                        {z.toFolder}
                      </button>
                      <p className="text-xs text-muted">{z.toFolderNote(base)}</p>
                    </>
                  ) : (
                    <p className="text-xs text-muted">{z.noFolderSupport}</p>
                  )}
                  {legacy && (
                    <>
                      <button type="button" className={`btn w-full ${canPickDir ? '' : 'btn-primary'}`} disabled={!rows.length} onClick={repack}>
                        <Download size={15} strokeWidth={2.2} />
                        {z.repack}
                      </button>
                      <p className="text-xs text-muted">{z.repackNote}</p>
                    </>
                  )}
                </>
              )}
              {outcome && (
                <p className={`text-sm ${outcome.failed ? 'text-danger' : 'text-ok'}`} aria-live="polite">
                  {outcome.kind === 'folder' ? z.extracted(outcome.ok, outcome.folder ?? '') : z.repacked(outcome.ok)}
                  {outcome.failed > 0 && ` ${z.failedCount(outcome.failed)}`}
                </p>
              )}
              <button type="button" className="btn w-full" disabled={!!work} onClick={() => setFile(null)}>
                {z.otherZip}
              </button>
            </div>
          </>
        )}
        {error && (
          <div className="space-y-3">
            <p className="text-sm text-danger">{z.errors[error]}</p>
            <button type="button" className="btn w-full" onClick={() => setFile(null)}>
              {z.otherZip}
            </button>
          </div>
        )}
      </aside>

      {archive && (
        <section className="min-w-0">
          {rows.length === 0 ? (
            <p className="panel p-6 text-center text-sm text-muted">{z.empty}</p>
          ) : (
            <ul className="panel divide-y divide-line overflow-hidden">
              {rows.slice(0, MAX_ROWS).map((r) => {
                const problem = entryProblem(r.entry) ?? rowError[r.index];
                return (
                  <li key={r.index} className="flex items-center gap-3 py-1.5 pr-1.5 pl-4">
                    {r.entry.encrypted ? <Lock size={15} className="shrink-0 text-danger" /> : <FileIcon size={15} className="shrink-0 text-muted" />}
                    <div className="min-w-0 flex-1">
                      <PathText path={r.name} />
                      {problem && <span className="block text-xs text-danger">{problemLabel(z, problem)}</span>}
                    </div>
                    <span className="hidden shrink-0 text-xs text-muted sm:inline">{fmtDate(r.entry.mtime)}</span>
                    <span className="shrink-0 text-xs text-muted">{formatBytes(r.entry.size)}</span>
                    <button
                      type="button"
                      className="grid size-8 shrink-0 place-items-center rounded-full text-muted hover:bg-panel-2 hover:text-fg disabled:opacity-30"
                      title={z.saveFile}
                      aria-label={z.saveFile}
                      disabled={!!entryProblem(r.entry) || !!work}
                      onClick={() => saveOne(r)}
                    >
                      <Download size={15} strokeWidth={2.2} />
                    </button>
                  </li>
                );
              })}
              {rows.length > MAX_ROWS && <li className="px-4 py-2.5 text-sm text-muted">{z.more(rows.length - MAX_ROWS)}</li>}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

/** File name first, its folder below in small muted text, so a long folder never hides the name */
function PathText({ path }: { path: string }) {
  const cut = path.lastIndexOf('/');
  return (
    <span className="block min-w-0 flex-1" title={path}>
      <span className="block truncate font-mono text-[13px]">{path.slice(cut + 1)}</span>
      {cut > 0 && <span className="block truncate font-mono text-[11px] text-muted">{path.slice(0, cut)}/</span>}
    </span>
  );
}

function Progress({ value, label }: { value: number; label?: string }) {
  return (
    <div className="flex h-9 items-center gap-3" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)}>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-panel-2">
        <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${value * 100}%` }} />
      </div>
      <span className="shrink-0 font-mono text-xs text-muted">{label ?? `${Math.floor(value * 100)}%`}</span>
    </div>
  );
}

export default withI18n(ZipTool);
