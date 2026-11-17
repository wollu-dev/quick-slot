import { useState } from 'react';
import { ArrowRight, CheckCircle2, Download, FolderOpen, LoaderCircle, XCircle } from 'lucide-react';
import CopyButton from '../../components/ui/CopyButton';
import DropZone, { filePath } from '../../components/ui/DropZone';
import Segmented from '../../components/ui/Segmented';
import Select from '../../components/ui/Select';
import TextPanel from '../../components/ui/TextPanel';
import { useT, withI18n } from '../../i18n';
import Rich from '../../i18n/Rich';
import { writeZip } from '../../lib/archive';
import { downloadBlob, timestampForFilename } from '../../lib/files';
import { asSeparated, changedCount, needsNfc, renameItem, scanFolder, type Form, type RenameItem, type RenameOutcome } from '../../lib/normalize';

type Mode = 'folder' | 'files' | 'text';

type DirPicker = (opts?: { mode?: 'readwrite' }) => Promise<FileSystemDirectoryHandle>;
const dirPicker = () => (typeof window !== 'undefined' ? (window as unknown as { showDirectoryPicker?: DirPicker }).showDirectoryPicker : undefined);

function UnicodeNormalize() {
  const t = useT();
  const u = t.normalize;
  const canFolder = !!dirPicker();
  const [mode, setMode] = useState<Mode>(canFolder ? 'folder' : 'files');
  return (
    <div className="space-y-4">
      <Segmented
        label={u.mode}
        value={mode}
        onChange={setMode}
        options={[...(canFolder ? ([['folder', u.modes.folder]] as const) : []), ['files', u.modes.files], ['text', u.modes.text]]}
      />
      {mode === 'folder' ? <Folder /> : mode === 'files' ? <Files /> : <Text />}
    </div>
  );
}

/** "ㅎㅏㄴㄱㅡㄹ → 한글" for one name */
function NameChange({ from, to }: { from: string; to: string }) {
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
      <span className="min-w-0 break-all text-muted line-through decoration-danger/60">{asSeparated(from)}</span>
      <ArrowRight size={13} className="shrink-0 text-muted" aria-hidden />
      <span className="min-w-0 break-all font-medium">{to}</span>
    </span>
  );
}

/* ------------------------------------------------------------------ */

function Folder() {
  const t = useT();
  const u = t.normalize;
  const [root, setRoot] = useState<FileSystemDirectoryHandle | null>(null);
  const [items, setItems] = useState<RenameItem[] | null>(null);
  const [scanning, setScanning] = useState(false);
  const [applying, setApplying] = useState(false);
  const [results, setResults] = useState<Map<RenameItem, RenameOutcome> | null>(null);

  const pick = async () => {
    let dir: FileSystemDirectoryHandle;
    try {
      dir = await dirPicker()!({ mode: 'readwrite' });
    } catch {
      return; // picker closed
    }
    setRoot(dir);
    setResults(null);
    setScanning(true);
    try {
      setItems(await scanFolder(dir));
    } catch {
      setItems([]);
    }
    setScanning(false);
  };

  const apply = async () => {
    if (!items) return;
    setApplying(true);
    const out = new Map<RenameItem, RenameOutcome>();
    // Deepest first, so a folder is renamed only after everything inside it
    for (const it of items) {
      out.set(it, await renameItem(it));
      setResults(new Map(out));
    }
    setApplying(false);
  };

  const done = results ? [...results.values()].filter((r) => r === 'renamed').length : 0;
  const problems = results ? [...results.values()].filter((r) => r !== 'renamed').length : 0;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="panel min-w-0 space-y-3 self-start p-4">
        <button type="button" className="btn btn-primary w-full" disabled={scanning || applying} onClick={pick}>
          {scanning ? <LoaderCircle size={15} className="animate-spin" /> : <FolderOpen size={15} strokeWidth={2.2} />}
          {root ? u.pickAgain : u.pickFolder}
        </button>
        {root && items && (
          <>
            <p className="text-sm">
              <Rich text={items.length ? u.found(root.name, items.length) : u.clean(root.name)} />
            </p>
            {items.length > 0 && !results && (
              <button type="button" className="btn btn-primary w-full" disabled={applying} onClick={apply}>
                {u.apply(items.length)}
              </button>
            )}
            {applying && <p className="text-sm text-muted">{u.applying}</p>}
            {results && !applying && (
              <p className={`text-sm ${problems ? 'text-danger' : 'text-ok'}`} aria-live="polite">
                {u.applied(done)}
                {problems > 0 && ` ${u.problems(problems)}`}
              </p>
            )}
          </>
        )}
        <p className="border-t border-line pt-3 text-xs text-muted">
          <Rich text={u.folderNote} />
        </p>
      </aside>

      <section className="min-w-0">
        {!root ? (
          <div className="panel p-6 text-sm text-muted">
            <Rich text={u.intro} />
          </div>
        ) : items && items.length > 0 ? (
          <ul className="panel divide-y divide-line">
            {items.map((it, i) => {
              const r = results?.get(it);
              return (
                <li key={i} className="flex items-start gap-3 px-4 py-2.5">
                  <span className="mt-0.5 shrink-0">
                    {r === 'renamed' ? <CheckCircle2 size={16} className="text-ok" /> : r ? <XCircle size={16} className="text-danger" /> : <span className="block size-4 rounded-full border-2 border-line" />}
                  </span>
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <NameChange from={it.from} to={it.to} />
                    <p className="truncate font-mono text-[11px] text-muted" title={it.path}>
                      {it.path.normalize('NFC')}
                    </p>
                    {r && r !== 'renamed' && <p className="text-xs text-danger">{u.outcomes[r]}</p>}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Files() {
  const t = useT();
  const u = t.normalize;
  const [files, setFiles] = useState<{ file: File; path: string }[]>([]);
  const [busy, setBusy] = useState(false);

  const add = (f: File[]) => setFiles((list) => [...list, ...f.map((file) => ({ file, path: filePath(file) }))]);
  const changed = files.filter((f) => needsNfc(f.path));

  const download = async () => {
    setBusy(true);
    try {
      if (files.length === 1) downloadBlob(files[0].file, files[0].file.name.normalize('NFC'));
      else {
        // Stored without compression: only the names change
        const zip = await writeZip(
          files.map((f) => ({ path: f.path.normalize('NFC'), data: f.file, mtime: new Date(f.file.lastModified) })),
          0,
        );
        downloadBlob(zip, `quickslot-nfc-${timestampForFilename()}.zip`);
      }
    } finally {
      setBusy(false);
    }
  };

  if (!files.length) {
    return (
      <div className="space-y-4">
        <DropZone onFiles={add} hint={u.filesHint} />
        <p className="text-sm text-muted">
          <Rich text={u.intro} />
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="panel min-w-0 space-y-3 self-start p-4">
        <p className="text-sm">
          <Rich text={u.filesSummary(files.length, changed.length)} />
        </p>
        <button type="button" className="btn btn-primary w-full" disabled={busy} onClick={download}>
          {busy ? <LoaderCircle size={15} className="animate-spin" /> : <Download size={15} strokeWidth={2.2} />}
          {files.length === 1 ? u.downloadOne : t.common.zipDownload(files.length)}
        </button>
        <button type="button" className="btn w-full" onClick={() => setFiles([])}>
          {t.common.reset}
        </button>
        <p className="border-t border-line pt-3 text-xs text-muted">{u.filesNote}</p>
      </aside>
      <section className="min-w-0 space-y-3">
        <DropZone onFiles={add} compact />
        <ul className="panel divide-y divide-line">
          {files.map((f, i) => (
            <li key={i} className="flex items-start gap-3 px-4 py-2.5">
              <span className="mt-0.5 shrink-0">{needsNfc(f.path) ? <CheckCircle2 size={16} className="text-ok" /> : <span className="block size-4 rounded-full border-2 border-line" />}</span>
              <div className="min-w-0 flex-1">
                {needsNfc(f.path) ? <NameChange from={f.path} to={f.path.normalize('NFC')} /> : <span className="block truncate text-sm text-muted">{f.path}</span>}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Text() {
  const t = useT();
  const u = t.normalize;
  const [text, setText] = useState('');
  const [form, setForm] = useState<Form>('NFC');
  const out = text.normalize(form);
  const n = changedCount(text, form);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="label">{u.form}</span>
        <Select
          id="un-form"
          value={form}
          onChange={setForm}
          className="w-56"
          options={[
            ['NFC', u.forms.NFC],
            ['NFD', u.forms.NFD],
            ['NFKC', u.forms.NFKC],
            ['NFKD', u.forms.NFKD],
          ]}
        />
        {text && <span className="text-sm text-muted">{n ? u.changed(n) : u.unchanged}</span>}
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <TextPanel label={t.common.input} value={text} onChange={setText} placeholder={u.textPlaceholder} />
        <TextPanel label={t.common.result} value={out} actions={<CopyButton text={out} />} />
      </div>
      {text && needsNfc(text) && (
        <p className="px-1 text-sm text-muted">
          {u.looksLike} <span className="font-medium text-fg">{asSeparated(text).slice(0, 120)}</span>
        </p>
      )}
      <p className="px-1 text-xs text-muted">{u.formNote}</p>
    </div>
  );
}

export default withI18n(UnicodeNormalize);
