import { useEffect, useState } from 'react';
import { Camera, CheckCircle2, Clock, MapPin, MinusCircle, Wrench, XCircle, type LucideIcon } from 'lucide-react';
import DropZone from '../../components/ui/DropZone';
import { useT, withI18n, type Dict } from '../../i18n';
import Rich from '../../i18n/Rich';
import { downloadBlob, formatBytes, makeZip, readBytes, timestampForFilename } from '../../lib/files';
import { MetadataError, stripMetadata, type FoundItem, type StripOptions, type StripResult } from '../../lib/metadata';

interface Row {
  file: File;
  result?: StripResult;
  error?: MetadataError['code'] | string;
}

const MIME = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' } as const;

/** 메타데이터 항목 이름 (코드 → 언어별 문구) */
function kindLabel(t: Dict, it: FoundItem): string {
  const k = t.metadata.kinds;
  switch (it.kind) {
    case 'app':
      return k.app(Number(it.param));
    case 'text':
      return k.text(String(it.param ?? ''));
    default:
      return k[it.kind];
  }
}

function errorLabel(t: Dict, err: string): string {
  return err in t.metadata.errors ? t.metadata.errors[err as MetadataError['code']] : err;
}

function MetadataRemover() {
  const t = useT();
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
          return { file, error: e instanceof MetadataError ? e.code : (e as Error).message };
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
        <DropZone onFiles={setFiles} accept="image/jpeg,image/png,image/webp" hint={t.metadata.dropHint} />
        <p className="text-sm text-muted">
          <Rich text={t.metadata.intro} />
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
            <span>
              {t.metadata.keepOrientation}
              <span className="block text-xs text-muted">{t.metadata.keepOrientationNote}</span>
            </span>
          </label>
          <label className="flex items-start gap-2">
            <input type="checkbox" className="mt-1" checked={opts.keepIcc} onChange={(e) => setOpts({ ...opts, keepIcc: e.target.checked })} />
            <span>
              {t.metadata.keepIcc}
              <span className="block text-xs text-muted">{t.metadata.keepIccNote}</span>
            </span>
          </label>
        </div>
        <div className="space-y-2 border-t border-line pt-4">
          <p className="text-sm">
            <Rich text={t.metadata.removedSummary(ok.length, formatBytes(Math.max(0, removedTotal)))} />
          </p>
          <button type="button" className="btn btn-primary w-full" disabled={!ok.length} onClick={download}>
            {ok.length === 1 ? t.metadata.downloadOne : t.common.zipDownload(ok.length)}
          </button>
          <button type="button" className="btn w-full" onClick={() => setFiles([])}>
            {t.common.reset}
          </button>
        </div>
      </aside>

      <section className="space-y-3">
        <DropZone onFiles={(f) => setFiles((p) => [...p, ...f])} accept="image/jpeg,image/png,image/webp" compact />
        {rows.map((r, i) => (
          <article key={i} className="panel p-4">
            <header className="mb-2 flex items-center justify-between gap-2">
              <h3 className="truncate font-mono text-sm" title={r.file.name}>
                {r.file.name}
              </h3>
              {r.result && (
                <span className="shrink-0 text-xs text-muted">
                  {formatBytes(r.file.size)} → {formatBytes(r.result.data.length)}
                </span>
              )}
            </header>

            {r.error && <p className="text-sm text-danger">{errorLabel(t, r.error)}</p>}

            {r.result?.exif && <ExifCard exif={r.result.exif} />}

            {r.result &&
              (r.result.items.length === 0 ? (
                <p className="flex items-center gap-1.5 text-sm text-ok">
                  <CheckCircle2 size={16} /> {t.metadata.nothing}
                </p>
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {r.result.items.map((it, j) => (
                    <li key={j} className="flex items-center gap-2">
                      {it.removed ? <XCircle size={16} className="shrink-0 text-danger" /> : <MinusCircle size={16} className="shrink-0 text-muted" />}
                      <span className={it.removed ? '' : 'text-muted'}>
                        {kindLabel(t, it)}
                        {!it.removed && ` ${t.metadata.kept}`}
                      </span>
                      {(it.detail || it.preview) && (
                        <span className="truncate text-xs text-muted">{it.detail ? t.metadata.details[it.detail] : it.preview}</span>
                      )}
                      <span className="ml-auto shrink-0 text-xs text-muted">{formatBytes(it.bytes)}</span>
                    </li>
                  ))}
                </ul>
              ))}
          </article>
        ))}
      </section>
    </div>
  );
}

function ExifCard({ exif }: { exif: NonNullable<StripResult['exif']> }) {
  const t = useT();
  const e = t.metadata.exif;
  const device = [exif.make, exif.model].filter(Boolean).join(' ');
  const rows: [LucideIcon, string, React.ReactNode][] = [];
  if (exif.gps) {
    rows.push([
      MapPin,
      e.location,
      exif.gps === 'present' ? (
        e.gpsPresent
      ) : (
        <a
          className="text-accent underline"
          target="_blank"
          rel="noreferrer"
          href={`https://www.openstreetmap.org/?mlat=${exif.gps.lat}&mlon=${exif.gps.lon}#map=16/${exif.gps.lat}/${exif.gps.lon}`}
        >
          {exif.gps.lat.toFixed(5)}, {exif.gps.lon.toFixed(5)} ({e.viewMap})
        </a>
      ),
    ]);
  }
  if (device) rows.push([Camera, e.device, device]);
  if (exif.dateTime) rows.push([Clock, e.taken, exif.dateTime]);
  if (exif.software) rows.push([Wrench, e.software, exif.software]);
  if (!rows.length) return null;

  return (
    <dl className={`mb-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 rounded-2xl p-3.5 text-sm ${exif.gps ? 'bg-danger/10' : 'bg-panel-2'}`}>
      {rows.map(([Icon, k, v]) => (
        <div key={k} className="contents">
          <dt className={`flex items-center gap-1.5 ${Icon === MapPin ? 'text-danger' : 'text-muted'}`}>
            <Icon size={14} strokeWidth={2.2} />
            {k}
          </dt>
          <dd className="min-w-0 truncate">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export default withI18n(MetadataRemover);
