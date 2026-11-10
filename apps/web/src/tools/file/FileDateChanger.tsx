import { useMemo, useState } from 'react';
import DropZone from '../../components/ui/DropZone';
import CopyButton from '../../components/ui/CopyButton';
import { downloadBlob, makeZip, readBytes, timestampForFilename } from '../../lib/files';

type Shell = 'powershell' | 'bash';

interface Targets {
  created: boolean;
  modified: boolean;
  accessed: boolean;
}

const pad = (n: number) => String(n).padStart(2, '0');
const toLocalInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

function powershellScript(items: { name: string; date: Date }[], t: Targets): string {
  const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
  const lines = items.map((it) => `  @(${q(it.name)}, ${q(fmt(it.date))})`).join(',\n');
  const sets = [
    t.created && '$f.CreationTime = $d',
    t.modified && '$f.LastWriteTime = $d',
    t.accessed && '$f.LastAccessTime = $d',
  ].filter(Boolean);
  return `# QuickSlot 파일 날짜 변경 스크립트 (Windows PowerShell)
# 파일이 있는 폴더에서 실행하세요.
if ($PSScriptRoot) { Set-Location -LiteralPath $PSScriptRoot }
$items = @(
${lines}
)
$ok = 0
foreach ($it in $items) {
  try {
    $f = Get-Item -LiteralPath $it[0] -ErrorAction Stop
    $d = [datetime]::ParseExact($it[1], 'yyyy-MM-dd HH:mm:ss', [Globalization.CultureInfo]::InvariantCulture)
    ${sets.join('; ')}
    Write-Host "OK  $($it[0])  ->  $($it[1])"
    $ok++
  } catch {
    Write-Host "실패 $($it[0]): $($_.Exception.Message)" -ForegroundColor Red
  }
}
Write-Host "$ok / $($items.Count) 개 완료"
`;
}

function bashScript(items: { name: string; date: Date }[], t: Targets): string {
  const q = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;
  const touchT = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}.${pad(d.getSeconds())}`;
  const setFile = (d: Date) => `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  const flags = [t.modified && '-m', t.accessed && '-a'].filter(Boolean).join(' ');
  const body = items
    .map((it) => {
      const cmds: string[] = [];
      if (flags) cmds.push(`touch ${flags} -t ${touchT(it.date)} -- ${q(it.name)}`);
      if (t.created) cmds.push(`set_created ${q(setFile(it.date))} ${q(it.name)}`);
      return `run ${q(it.name)} && ${cmds.join(' && ') || 'true'}`;
    })
    .join('\n');
  return `#!/usr/bin/env bash
# QuickSlot 파일 날짜 변경 스크립트 (macOS / Linux)
# 파일이 있는 폴더에서 실행하세요:  bash change-dates.sh
cd "$(dirname "$0")" 2>/dev/null || true
ok=0; total=0
run() { total=$((total+1)); if [ -e "$1" ]; then ok=$((ok+1)); return 0; else echo "없음: $1" >&2; return 1; fi; }
set_created() {
  # 생성일은 macOS 에서만 바꿀 수 있어요 (Xcode 명령줄 도구의 SetFile 필요)
  if command -v SetFile >/dev/null 2>&1; then SetFile -d "$1" -- "$2"; fi
}
${body}
echo "$ok / $total 개 완료"
`;
}

export default function FileDateChanger() {
  const [files, setFiles] = useState<File[]>([]);
  const [date, setDate] = useState(() => toLocalInput(new Date(new Date().setHours(9, 0, 0, 0))));
  const [stepSec, setStepSec] = useState(0);
  const [targets, setTargets] = useState<Targets>({ created: true, modified: true, accessed: false });
  const [shell, setShell] = useState<Shell>(() =>
    typeof navigator !== 'undefined' && /Mac|Linux/.test(navigator.userAgent) && !/Android/.test(navigator.userAgent) ? 'bash' : 'powershell',
  );
  const [busy, setBusy] = useState(false);

  const base = new Date(date);
  const valid = !Number.isNaN(base.getTime());
  const items = useMemo(
    () => (valid ? files.map((f, i) => ({ name: f.name, date: new Date(base.getTime() + i * stepSec * 1000) })) : []),
    [files, date, stepSec, valid],
  );
  const noTarget = !targets.created && !targets.modified && !targets.accessed;
  const script = !items.length || noTarget ? '' : shell === 'powershell' ? powershellScript(items, targets) : bashScript(items, targets);

  const downloadScript = () => {
    // Windows PowerShell 5.1 은 BOM 이 없으면 한글 파일명을 깨뜨림 → UTF-8 BOM 으로 저장
    const blob =
      shell === 'powershell'
        ? new Blob(['﻿' + script.replace(/\n/g, '\r\n')], { type: 'text/plain;charset=utf-8' })
        : new Blob([script], { type: 'text/x-shellscript' });
    downloadBlob(blob, shell === 'powershell' ? 'change-dates.ps1' : 'change-dates.sh');
  };

  const downloadZip = async () => {
    setBusy(true);
    try {
      const entries = await Promise.all(files.map(async (f, i) => ({ name: f.name, data: await readBytes(f), mtime: items[i].date })));
      downloadBlob(makeZip(entries), `quickslot-dated-${timestampForFilename()}.zip`);
    } finally {
      setBusy(false);
    }
  };

  const dupNames = new Set(files.map((f) => f.name)).size !== files.length;

  if (!files.length) {
    return (
      <div className="space-y-4">
        <DropZone onFiles={setFiles} hint="날짜를 바꿀 파일을 고르세요. 파일 내용은 읽지 않아요." />
        <div className="panel p-4 text-sm leading-relaxed text-muted">
          <b className="text-fg">왜 스크립트인가요?</b> 브라우저는 보안상 내 PC 파일의 날짜를 직접 바꿀 수 없어요. 그래서 원하는 날짜로 바꿔주는
          명령어를 만들어 드려요. 복사해서 붙여넣기만 하면 끝이에요.
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <aside className="panel space-y-4 self-start p-4">
        <div>
          <label className="label" htmlFor="date">바꿀 날짜·시간</label>
          <input id="date" type="datetime-local" step={1} className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="step">파일마다 시간 늘리기 (초)</label>
          <input id="step" type="number" min={0} className="input" value={stepSec} onChange={(e) => setStepSec(Math.max(0, Number(e.target.value) || 0))} />
          <p className="mt-1 text-xs text-muted">0이면 모두 같은 시각. 60이면 1분 간격으로 순서대로.</p>
        </div>
        <fieldset className="space-y-1.5 text-sm">
          <legend className="label">바꿀 항목</legend>
          {([
            ['created', '만든 날짜 (생성일)'],
            ['modified', '수정한 날짜'],
            ['accessed', '액세스한 날짜'],
          ] as const).map(([k, label]) => (
            <label key={k} className="flex items-center gap-2">
              <input type="checkbox" checked={targets[k]} onChange={(e) => setTargets({ ...targets, [k]: e.target.checked })} /> {label}
            </label>
          ))}
        </fieldset>
        <div className="space-y-2 border-t border-line pt-4">
          <button type="button" className="btn w-full" onClick={() => setFiles([])}>처음부터</button>
          <button type="button" className="btn w-full" disabled={busy || !valid} onClick={downloadZip} title="압축을 풀면 수정한 날짜가 적용돼요">
            {busy ? '만드는 중...' : '또는: 날짜 적용된 ZIP으로 받기'}
          </button>
          <p className="text-xs text-muted">ZIP은 <b>수정한 날짜</b>만 담을 수 있어요. 생성일까지 바꾸려면 스크립트를 쓰세요.</p>
        </div>
      </aside>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-line p-0.5 text-sm">
            {([
              ['powershell', 'Windows'],
              ['bash', 'macOS / Linux'],
            ] as const).map(([k, label]) => (
              <button key={k} type="button" onClick={() => setShell(k)} className={`rounded-md px-3 py-1 ${shell === k ? 'bg-panel-2 text-fg' : 'text-muted'}`}>
                {label}
              </button>
            ))}
          </div>
          <div className="ml-auto flex gap-2">
            <CopyButton text={script} label="스크립트 복사" />
            <button type="button" className="btn btn-primary" disabled={!script} onClick={downloadScript}>파일로 받기</button>
          </div>
        </div>

        {dupNames && <p className="rounded-lg bg-danger/10 p-3 text-sm text-danger">이름이 같은 파일이 있어요. 스크립트는 실행한 폴더의 파일 이름으로 찾기 때문에 같은 폴더의 파일끼리 나눠서 만드세요.</p>}
        {noTarget && <p className="text-sm text-danger">바꿀 항목을 하나 이상 고르세요.</p>}

        <ol className="panel space-y-2 p-4 text-sm leading-relaxed">
          {shell === 'powershell' ? (
            <>
              <li>1. 파일이 있는 폴더를 탐색기로 열고, 주소창에 <code className="kbd">powershell</code> 입력 후 Enter</li>
              <li>2. 복사한 스크립트를 붙여넣고 Enter</li>
              <li className="text-xs text-muted">파일로 받았다면: 그 폴더에 넣고 <code>powershell -ExecutionPolicy Bypass -File change-dates.ps1</code></li>
            </>
          ) : (
            <>
              <li>1. 터미널에서 파일이 있는 폴더로 이동 (<code>cd 폴더경로</code>)</li>
              <li>2. 복사한 스크립트를 붙여넣고 Enter</li>
              <li className="text-xs text-muted">macOS는 더 옛날 날짜로 수정일을 바꾸면 생성일도 함께 바뀌어요. Linux는 생성일을 바꿀 수 없어요.</li>
            </>
          )}
        </ol>

        <pre className="panel max-h-[50vh] overflow-auto p-4 font-mono text-xs leading-relaxed text-muted">{script || '—'}</pre>
      </section>
    </div>
  );
}
