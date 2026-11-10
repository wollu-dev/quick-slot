import { useEffect, useState } from 'react';
import DropZone from '../../components/ui/DropZone';
import { downloadBlob, formatBytes, makeZip, readBytes, timestampForFilename } from '../../lib/files';
import { stripMetadata, type StripOptions, type StripResult } from '../../lib/metadata';

interface Row {
  file: File;
  result?: StripResult;
  error?: string;
}

const MIME = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' } as const;

export default function MetadataRemover() {
  const [files, setFiles] = useState<File[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [opts, setOpts] = useState<StripOptions>({ keepOrientation: true, keepIcc: true });

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      files.map(async (file): Promise<Row> => {
        try {
          return { file, result: stripMetadata(await readBytes(file), opts) };
        } catch (e) {
          return { file, error: (e as Error).message };
        }
      }),
    ).then((r) => !cancelled && setRows(r));
    return () => {
      cancelled = true;
    };
  }, [files, opts]);

  const ok = rows.filter((r) => r.result);
  const removedTotal = ok.reduce((n, r) => n + (r.file.size - r.result!.data.length), 0);

  const download = () => {
    if (ok.length === 1) {
      const r = ok[0].result!;
      downloadBlob(new Blob([r.data as Uint8Array<ArrayBuffer>], { type: MIME[r.format] }), ok[0].file.name);
    } else {
      downloadBlob(makeZip(ok.map((r) => ({ name: r.file.name, data: r.result!.data }))), `quickslot-clean-${timestampForFilename()}.zip`);
    }
  };

  if (!files.length) {
    return (
      <div className="space-y-4">
        <DropZone onFiles={setFiles} accept="image/jpeg,image/png,image/webp" hint="JPEG · PNG · WebP — 화질은 그대로, 정보만 지워요" />
        <p className="text-sm text-muted">
          스마트폰 사진에는 찍은 <b className="text-fg">위치(GPS)</b>, 기기 모델, 날짜가 들어 있어요. 중고거래나 SNS에 올리기 전에 지우세요.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
      <aside className="panel space-y-4 self-start p-4">
        <div className="space-y-2 text-sm">
          <label className="flex items-start gap-2">
            <input type="checkbox" className="mt-1" checked={opts.keepOrientation} onChange={(e) => setOpts({ ...opts, keepOrientation: e.target.checked })} />
            <span>회전 정보 유지<span className="block text-xs text-muted">끄면 세로 사진이 눕혀져 보일 수 있어요</span></span>
          </label>
          <label className="flex items-start gap-2">
            <input type="checkbox" className="mt-1" checked={opts.keepIcc} onChange={(e) => setOpts({ ...opts, keepIcc: e.target.checked })} />
            <span>색상 프로필 유지<span className="block text-xs text-muted">개인정보가 아니에요. 끄면 색이 달라 보일 수 있어요</span></span>
          </label>
        </div>
        <div className="space-y-2 border-t border-line pt-4">
          <p className="text-sm">
            {ok.length}개 파일에서 <b className="text-accent">{formatBytes(Math.max(0, removedTotal))}</b> 제거
          </p>
          <button type="button" className="btn btn-primary w-full" disabled={!ok.length} onClick={download}>
            {ok.length === 1 ? '깨끗한 파일 받기' : `ZIP으로 받기 (${ok.length}개)`}
          </button>
          <button type="button" className="btn w-full" onClick={() => setFiles([])}>처음부터</button>
        </div>
      </aside>

      <section className="space-y-3">
        <DropZone onFiles={(f) => setFiles((p) => [...p, ...f])} accept="image/jpeg,image/png,image/webp" compact />
        {rows.map((r, i) => (
          <article key={i} className="panel p-4">
            <header className="mb-2 flex items-center justify-between gap-2">
              <h3 className="truncate font-mono text-sm" title={r.file.name}>{r.file.name}</h3>
              {r.result && (
                <span className="shrink-0 text-xs text-muted">
                  {formatBytes(r.file.size)} → {formatBytes(r.result.data.length)}
                </span>
              )}
            </header>

            {r.error && <p className="text-sm text-danger">{r.error}</p>}

            {r.result?.exif && <ExifCard exif={r.result.exif} />}

            {r.result && (
              r.result.items.length === 0 ? (
                <p className="text-sm text-ok">✓ 지울 메타데이터가 없어요</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {r.result.items.map((it, j) => (
                    <li key={j} className="flex items-baseline gap-2">
                      <span className={it.removed ? 'text-danger' : 'text-muted'}>{it.removed ? '✕' : '•'}</span>
                      <span className={it.removed ? '' : 'text-muted'}>
                        {it.kind}
                        {!it.removed && ' (유지)'}
                      </span>
                      {it.detail && <span className="truncate text-xs text-muted">{it.detail}</span>}
                      <span className="ml-auto shrink-0 text-xs text-muted">{formatBytes(it.bytes)}</span>
                    </li>
                  ))}
                </ul>
              )
            )}
          </article>
        ))}
      </section>
    </div>
  );
}

function ExifCard({ exif }: { exif: NonNullable<StripResult['exif']> }) {
  const device = [exif.make, exif.model].filter(Boolean).join(' ');
  const rows: [string, React.ReactNode][] = [];
  if (exif.gps) {
    rows.push([
      '📍 위치',
      exif.gps === 'present' ? (
        'GPS 정보 있음'
      ) : (
        <a className="text-accent underline" target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/?mlat=${exif.gps.lat}&mlon=${exif.gps.lon}#map=16/${exif.gps.lat}/${exif.gps.lon}`}>
          {exif.gps.lat.toFixed(5)}, {exif.gps.lon.toFixed(5)} (지도에서 보기)
        </a>
      ),
    ]);
  }
  if (device) rows.push(['📱 기기', device]);
  if (exif.dateTime) rows.push(['🕒 촬영', exif.dateTime]);
  if (exif.software) rows.push(['🛠 프로그램', exif.software]);
  if (!rows.length) return null;

  return (
    <dl className={`mb-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-lg p-3 text-sm ${exif.gps ? 'bg-danger/10' : 'bg-panel-2'}`}>
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted">{k}</dt>
          <dd className="min-w-0 truncate">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
