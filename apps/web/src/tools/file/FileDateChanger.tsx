import { useMemo, useState } from 'react';
import DropZone from '../../components/ui/DropZone';
import CopyButton from '../../components/ui/CopyButton';
import Segmented from '../../components/ui/Segmented';
import { useT, withI18n, type Dict } from '../../i18n';
import Rich from '../../i18n/Rich';
import { downloadBlob, makeZip, readBytes, timestampForFilename } from '../../lib/files';

type Shell = 'powershell' | 'bash';
type ScriptText = Dict['fileDate']['script'];

interface Targets {
  created: boolean;
  modified: boolean;
  accessed: boolean;
}

const pad = (n: number) => String(n).padStart(2, '0');
const toLocalInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

function powershellScript(items: { name: string; date: Date }[], t: Targets, s: ScriptText): string {
  const q = (v: string) => `'${v.replace(/'/g, "''")}'`;
  const lines = items.map((it) => `  @(${q(it.name)}, ${q(fmt(it.date))})`).join(',\n');
  const sets = [
    t.created && '$f.CreationTime = $d',
    t.modified && '$f.LastWriteTime = $d',
    t.accessed && '$f.LastAccessTime = $d',
  ].filter(Boolean);
  return `# ${s.psTitle}
# ${s.runHere}
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
    Write-Host "${s.failed} $($it[0]): $($_.Exception.Message)" -ForegroundColor Red
  }
}
Write-Host "$ok / $($items.Count) ${s.done}"
`;
}

function bashScript(items: { name: string; date: Date }[], t: Targets, s: ScriptText): string {
  const q = (v: string) => `'${v.replace(/'/g, `'\\''`)}'`;
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
# ${s.bashTitle}
# ${s.bashRunHere}
cd "$(dirname "$0")" 2>/dev/null || true
ok=0; total=0
run() { total=$((total+1)); if [ -e "$1" ]; then ok=$((ok+1)); return 0; else echo "${s.missing}: $1" >&2; return 1; fi; }
set_created() {
  # ${s.createdNote}
  if command -v SetFile >/dev/null 2>&1; then SetFile -d "$1" -- "$2"; fi
}
${body}
echo "$ok / $total ${s.done}"
`;
}

function FileDateChanger() {
  const t = useT();
  const f = t.fileDate;
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
    () => (valid ? files.map((file, i) => ({ name: file.name, date: new Date(base.getTime() + i * stepSec * 1000) })) : []),
    [files, date, stepSec, valid],
  );
  const noTarget = !targets.created && !targets.modified && !targets.accessed;
  const script = !items.length || noTarget ? '' : shell === 'powershell' ? powershellScript(items, targets, f.script) : bashScript(items, targets, f.script);

  const downloadScript = () => {
    // Windows PowerShell 5.1 은 BOM 이 없으면 한글·일본어 파일명을 깨뜨림 → UTF-8 BOM 으로 저장
    const blob =
      shell === 'powershell'
        ? new Blob(['﻿' + script.replace(/\n/g, '\r\n')], { type: 'text/plain;charset=utf-8' })
        : new Blob([script], { type: 'text/x-shellscript' });
    downloadBlob(blob, shell === 'powershell' ? 'change-dates.ps1' : 'change-dates.sh');
  };

  const downloadZip = async () => {
    setBusy(true);
    try {
      const entries = await Promise.all(files.map(async (file, i) => ({ name: file.name, data: await readBytes(file), mtime: items[i].date })));
      downloadBlob(makeZip(entries), `quickslot-dated-${timestampForFilename()}.zip`);
    } finally {
      setBusy(false);
    }
  };

  const dupNames = new Set(files.map((file) => file.name)).size !== files.length;

  if (!files.length) {
    return (
      <div className="space-y-4">
        <DropZone onFiles={setFiles} hint={f.dropHint} />
        <div className="panel p-4 text-sm leading-relaxed text-muted">
          <Rich text={f.why} />
        </div>
      </div>
    );
  }

  const steps = shell === 'powershell' ? f.winSteps : f.unixSteps;

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <aside className="panel space-y-4 self-start p-4">
        <div>
          <label className="label" htmlFor="date">{f.date}</label>
          <input id="date" type="datetime-local" step={1} className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="step">{f.step}</label>
          <input id="step" type="number" min={0} className="input" value={stepSec} onChange={(e) => setStepSec(Math.max(0, Number(e.target.value) || 0))} />
          <p className="mt-1 text-xs text-muted">{f.stepNote}</p>
        </div>
        <fieldset className="space-y-1.5 text-sm">
          <legend className="label">{f.targets}</legend>
          {(['created', 'modified', 'accessed'] as const).map((k) => (
            <label key={k} className="flex items-center gap-2">
              <input type="checkbox" checked={targets[k]} onChange={(e) => setTargets({ ...targets, [k]: e.target.checked })} /> {f[k]}
            </label>
          ))}
        </fieldset>
        <div className="space-y-2 border-t border-line pt-4">
          <button type="button" className="btn w-full" onClick={() => setFiles([])}>
            {t.common.reset}
          </button>
          <button type="button" className="btn w-full" disabled={busy || !valid} onClick={downloadZip} title={f.zipTitle}>
            {busy ? t.common.working : f.zip}
          </button>
          <p className="text-xs text-muted">
            <Rich text={f.zipNote} />
          </p>
        </div>
      </aside>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            label={f.os}
            value={shell}
            onChange={setShell}
            options={[
              ['powershell', 'Windows'],
              ['bash', 'macOS / Linux'],
            ]}
          />
          <div className="ml-auto flex gap-2">
            <CopyButton text={script} label={f.copyScript} />
            <button type="button" className="btn btn-primary" disabled={!script} onClick={downloadScript}>
              {f.downloadScript}
            </button>
          </div>
        </div>

        {dupNames && <p className="rounded-2xl bg-danger/10 p-3 text-sm text-danger">{f.dupNames}</p>}
        {noTarget && <p className="text-sm text-danger">{f.noTarget}</p>}

        <ol className="panel space-y-2 p-4 text-sm leading-relaxed">
          {steps.map((s, i) => (
            <li key={i}>
              {i + 1}. <Rich text={s} />
            </li>
          ))}
          <li className="text-xs text-muted">
            <Rich text={shell === 'powershell' ? f.winFileNote : f.unixNote} codeClassName="font-mono" />
          </li>
        </ol>

        <pre className="panel max-h-[50vh] overflow-auto p-4 font-mono text-xs leading-relaxed text-muted">{script || '—'}</pre>
      </section>
    </div>
  );
}

export default withI18n(FileDateChanger);
