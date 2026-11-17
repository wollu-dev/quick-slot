import { useRef, useState } from 'react';
import { CircleCheck, Cloud, Download, LoaderCircle, Scale, Search } from 'lucide-react';
import { LANG_TAGS, useLang, useT, withI18n } from '../../i18n';
import Rich from '../../i18n/Rich';
import Select from '../../components/ui/Select';
import { formatsFor, giveConsent, hasConsent, prepare, save, videoInfo, VideoFailure, type JobState, type VideoError, type VideoFormat, type VideoInfo } from '../../lib/videoDownload';

const pad = (n: number) => String(n).padStart(2, '0');
function clock(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

function VideoDownloader() {
  const t = useT();
  const v = t.videoDownloader;
  const lang = useLang();
  const [url, setUrl] = useState('');
  const [info, setInfo] = useState<(VideoInfo & { url: string }) | null>(null);
  const [format, setFormat] = useState<VideoFormat>('mp4-720');
  const [agreed, setAgreed] = useState(false);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState<'info' | 'download' | null>(null);
  const [job, setJob] = useState<JobState | null>(null);
  const [saved, setSaved] = useState<{ name: string; size: number } | null>(null);
  const [error, setError] = useState<VideoError | null>(null);
  const abort = useRef<AbortController | null>(null);

  const fail = (e: unknown) => {
    if (e instanceof DOMException && e.name === 'AbortError') return;
    setError(e instanceof VideoFailure ? e.code : 'offline');
  };

  const look = async () => {
    const target = url.trim();
    if (!target) return;
    if (!hasConsent()) {
      setAsking(true);
      return;
    }
    abort.current?.abort();
    setBusy('info');
    setError(null);
    setInfo(null);
    setSaved(null);
    setJob(null);
    // The rights check is about one video: ask again for each one
    setAgreed(false);
    try {
      const i = await videoInfo(target);
      setInfo({ ...i, url: target });
      setFormat(formatsFor(i)[0]);
    } catch (e) {
      fail(e);
    }
    setBusy(null);
  };

  const download = async () => {
    if (!info || !agreed) return;
    const ctl = new AbortController();
    abort.current = ctl;
    setBusy('download');
    setError(null);
    setSaved(null);
    setJob({ status: 'queued', progress: 0 });
    try {
      const file = await prepare(info.url, format, setJob, ctl.signal);
      save(file.href, file.name);
      setSaved({ name: file.name, size: file.size });
    } catch (e) {
      fail(e);
    }
    setJob(null);
    setBusy(null);
  };

  const size = (n: number) => {
    const [unit, div] = n >= 1 << 30 ? (['gigabyte', 1 << 30] as const) : n >= 1 << 20 ? (['megabyte', 1 << 20] as const) : (['kilobyte', 1 << 10] as const);
    return new Intl.NumberFormat(LANG_TAGS[lang], { style: 'unit', unit, maximumFractionDigits: 1 }).format(n / div);
  };

  return (
    <div className="space-y-4">
      <form
        className="panel flex flex-wrap items-center gap-2 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          look();
        }}
      >
        <input
          className="input min-w-0 flex-1 basis-60"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={v.placeholder}
          aria-label={v.address}
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
        />
        <button type="submit" className="btn btn-primary" disabled={!!busy || !url.trim()}>
          {busy === 'info' ? <LoaderCircle size={15} className="animate-spin" /> : <Search size={15} />}
          {busy === 'info' ? v.looking : v.look}
        </button>
      </form>

      {asking && (
        <div className="panel space-y-3 p-4" role="dialog" aria-labelledby="vd-consent">
          <p id="vd-consent" className="flex items-start gap-2 text-sm">
            <Cloud size={16} className="mt-0.5 shrink-0 text-accent" />
            <span>
              <Rich text={v.consent} />
            </span>
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                giveConsent();
                setAsking(false);
                look();
              }}
            >
              {v.consentOk}
            </button>
            <button type="button" className="btn" onClick={() => setAsking(false)}>
              {v.consentNo}
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="panel p-4 text-sm text-danger" role="alert">
          {v.errors[error]}
        </p>
      )}

      {info && (
        <section className="panel space-y-4 p-4">
          <div className="min-w-0">
            <p className="text-xs text-muted">{info.site}</p>
            <h2 className="break-words font-semibold" data-video-title>
              {info.title || v.untitled}
            </h2>
            <p className="text-sm text-muted">
              {[info.uploader, info.duration ? clock(info.duration) : null].filter(Boolean).join(' · ')}
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-0 basis-56">
              <span className="label" id="vd-format-label">
                {v.format}
              </span>
              <Select id="vd-format" label={v.format} value={format} onChange={setFormat} options={formatsFor(info).map((f) => [f, v.formats[f]] as const)} className="w-full" />
            </div>
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5" />
            <span>{v.rightsCheck}</span>
          </label>
          {job ? (
            <div className="flex h-9 items-center gap-3" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(job.progress * 100)}>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-panel-2">
                <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${job.progress * 100}%` }} />
              </div>
              <span className="shrink-0 text-xs text-muted">{job.status === 'queued' ? v.queued : `${Math.floor(job.progress * 100)}%`}</span>
            </div>
          ) : (
            <button type="button" className="btn btn-primary" disabled={!agreed || !!busy} onClick={download}>
              <Download size={15} />
              {v.download}
            </button>
          )}
          {saved && (
            <p className="flex items-start gap-2 text-sm text-ok" data-saved>
              <CircleCheck size={16} className="mt-0.5 shrink-0" />
              <span className="min-w-0 break-words">{v.saved(saved.name, size(saved.size))}</span>
            </p>
          )}
        </section>
      )}

      {!info && !asking && (
        <div className="panel p-6 text-sm text-muted">
          <Rich text={v.intro} />
        </div>
      )}

      <aside className="panel flex items-start gap-2 p-4 text-xs text-muted">
        <Scale size={15} className="mt-0.5 shrink-0" />
        <span>
          <Rich text={v.rights} />
        </span>
      </aside>
    </div>
  );
}

export default withI18n(VideoDownloader);
