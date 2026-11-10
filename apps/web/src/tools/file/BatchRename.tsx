import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import DropZone from '../../components/ui/DropZone';
import Select from '../../components/ui/Select';
import { dedupeNames, downloadBlob, formatBytes, makeZip, readBytes, splitName, timestampForFilename } from '../../lib/files';

type Mode = 'extension' | 'rename';
type CaseMode = 'none' | 'lower' | 'upper';

interface Options {
  // 확장자 모드
  newExt: string;
  onlyExts: string;
  // 이름 모드
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
  newExt: '',
  onlyExts: '',
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

function buildName(file: File, index: number, mode: Mode, o: Options): { name: string; error?: string } {
  const { base, ext } = splitName(file.name);

  if (mode === 'extension') {
    const filter = o.onlyExts
      .split(/[,\s]+/)
      .map((s) => s.replace(/^\./, '').toLowerCase())
      .filter(Boolean);
    if (filter.length && !filter.includes(ext.toLowerCase())) return { name: file.name };
    const next = o.newExt.trim().replace(/^\.+/, '');
    return { name: next ? `${base}.${next}` : base };
  }

  let b = base;
  if (o.find) {
    try {
      const re = o.useRegex
        ? new RegExp(o.find, o.ignoreCase ? 'gi' : 'g')
        : new RegExp(o.find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), o.ignoreCase ? 'gi' : 'g');
      b = b.replace(re, o.replace);
    } catch (e) {
      return { name: file.name, error: '정규식 오류: ' + (e as Error).message };
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

export default function BatchRename({ mode }: { mode: Mode }) {
  const [files, setFiles] = useState<File[]>([]);
  const [o, setO] = useState<Options>(DEFAULTS);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Options>(k: K, v: Options[K]) => setO((prev) => ({ ...prev, [k]: v }));

  const rows = useMemo(() => {
    const built = files.map((f, i) => buildName(f, i, mode, o));
    const finalNames = dedupeNames(built.map((b) => b.name));
    return files.map((file, i) => ({
      file,
      next: finalNames[i],
      deduped: finalNames[i] !== built[i].name,
      error: built[i].error ?? (INVALID.test(built[i].name) ? '파일 이름에 쓸 수 없는 문자 (\\ / : * ? " < > |)' : !built[i].name.trim() ? '이름이 비어 있음' : undefined),
    }));
  }, [files, o, mode]);

  const changed = rows.filter((r) => r.next !== r.file.name).length;
  const hasError = rows.some((r) => r.error);

  const addFiles = (incoming: File[]) =>
    setFiles((prev) => [...prev, ...incoming].sort((a, b) => a.name.localeCompare(b.name, 'ko', { numeric: true })));

  const download = async () => {
    setBusy(true);
    try {
      if (rows.length === 1) {
        downloadBlob(rows[0].file, rows[0].next);
      } else {
        const entries = await Promise.all(
          rows.map(async (r) => ({ name: r.next, data: await readBytes(r.file), mtime: new Date(r.file.lastModified) })),
        );
        downloadBlob(makeZip(entries), `quickslot-${mode === 'extension' ? 'ext' : 'rename'}-${timestampForFilename()}.zip`);
      }
    } finally {
      setBusy(false);
    }
  };

  if (!files.length) {
    return <DropZone onFiles={addFiles} hint="여러 파일이나 폴더를 한 번에 넣을 수 있어요" />;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <aside className="panel space-y-4 self-start p-4">
        {mode === 'extension' ? (
          <>
            <div>
              <label className="label" htmlFor="newExt">새 확장자</label>
              <input id="newExt" className="input font-mono" placeholder="예: jpg (비우면 확장자 제거)" value={o.newExt} onChange={(e) => set('newExt', e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="onlyExts">이 확장자만 바꾸기 (선택)</label>
              <input id="onlyExts" className="input font-mono" placeholder="예: jpeg, JPG" value={o.onlyExts} onChange={(e) => set('onlyExts', e.target.value)} />
            </div>
            <p className="rounded-2xl bg-panel-2 p-3 text-xs leading-relaxed text-muted">
              확장자만 바꾸면 파일 내용은 그대로예요. PNG를 JPG로 <b className="text-fg">형식 자체를 변환</b>하려면 이미지 변환 툴을 쓰세요.
            </p>
          </>
        ) : (
          <>
            <div>
              <label className="label" htmlFor="find">찾기</label>
              <input id="find" className="input font-mono" value={o.find} onChange={(e) => set('find', e.target.value)} />
              <div className="mt-1.5 flex gap-3 text-xs text-muted">
                <label className="flex items-center gap-1"><input type="checkbox" checked={o.useRegex} onChange={(e) => set('useRegex', e.target.checked)} /> 정규식</label>
                <label className="flex items-center gap-1"><input type="checkbox" checked={o.ignoreCase} onChange={(e) => set('ignoreCase', e.target.checked)} /> 대소문자 무시</label>
              </div>
            </div>
            <div>
              <label className="label" htmlFor="replace">바꾸기</label>
              <input id="replace" className="input font-mono" value={o.replace} onChange={(e) => set('replace', e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="pattern">이름 패턴</label>
              <input id="pattern" className="input font-mono" value={o.pattern} onChange={(e) => set('pattern', e.target.value)} />
              <p className="mt-1 text-xs text-muted">
                <code className="text-fg">{'{name}'}</code> 원래 이름 · <code className="text-fg">{'{n}'}</code> 번호 — 예: <code>photo_{'{n}'}</code>
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label" htmlFor="start">시작 번호</label>
                <input id="start" type="number" className="input" value={o.start} onChange={(e) => set('start', Number(e.target.value) || 0)} />
              </div>
              <div>
                <label className="label" htmlFor="pad">자릿수</label>
                <input id="pad" type="number" min={0} max={10} className="input" value={o.pad} onChange={(e) => set('pad', Math.min(10, Math.max(0, Number(e.target.value) || 0)))} />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="case">대소문자</label>
              <Select
                id="case"
                value={o.caseMode}
                onChange={(v) => set('caseMode', v)}
                options={[
                  ['none', '그대로'],
                  ['lower', '모두 소문자'],
                  ['upper', '모두 대문자'],
                ]}
              />
            </div>
            <div className="space-y-1.5 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={o.spaceToUnderscore} onChange={(e) => set('spaceToUnderscore', e.target.checked)} /> 공백을 _ 로</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={o.extLower} onChange={(e) => set('extLower', e.target.checked)} /> 확장자 소문자로 (.JPG → .jpg)</label>
            </div>
          </>
        )}

        <div className="space-y-2 border-t border-line pt-4">
          <button type="button" className="btn btn-primary w-full" disabled={busy || hasError || changed === 0} onClick={download}>
            {busy ? '만드는 중...' : rows.length === 1 ? '파일 다운로드' : `ZIP으로 받기 (${changed}개 변경)`}
          </button>
          <button type="button" className="btn w-full" onClick={() => setFiles([])}>처음부터</button>
          {rows.length > 1 && <p className="text-xs text-muted">ZIP 안의 파일은 원래 수정 날짜를 유지해요.</p>}
        </div>
      </aside>

      <section className="space-y-3">
        <DropZone onFiles={addFiles} compact />
        <div className="panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-4 py-2 text-xs text-muted">
            <span>파일 {rows.length}개 · 변경 {changed}개</span>
          </div>
          <ul className="max-h-[60vh] divide-y divide-line overflow-y-auto text-sm">
            {rows.map((r, i) => (
              <li key={i} className="grid grid-cols-[1fr_auto] items-center gap-2 px-4 py-2">
                <div className="min-w-0 font-mono text-[13px]">
                  <div className="truncate text-muted" title={r.file.name}>{r.file.name}</div>
                  <div className={`truncate ${r.error ? 'text-danger' : r.next !== r.file.name ? 'text-accent' : 'text-muted/60'}`} title={r.next}>
                    → {r.next}
                    {r.deduped && <span className="ml-2 font-sans text-xs text-muted">(이름 중복으로 번호 추가)</span>}
                  </div>
                  {r.error && <div className="font-sans text-xs text-danger">{r.error}</div>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted">{formatBytes(r.file.size)}</span>
                  <button type="button" className="grid size-6 place-items-center rounded-full text-muted transition hover:bg-danger/10 hover:text-danger" aria-label="목록에서 빼기" onClick={() => setFiles((p) => p.filter((_, j) => j !== i))}>
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
