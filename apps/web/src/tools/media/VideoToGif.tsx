import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Download, Film, LoaderCircle } from 'lucide-react';
import DropZone from '../../components/ui/DropZone';
import Segmented from '../../components/ui/Segmented';
import Select from '../../components/ui/Select';
import { useT, withI18n } from '../../i18n';
import Rich from '../../i18n/Rich';
import { downloadBlob, formatBytes } from '../../lib/files';
import { formatTime, frameCount, videoToGif, type GifOptions, type GifQuality } from '../../lib/videoGif';

/** Clips longer than this many frames take long and make very large GIFs */
const MANY_FRAMES = 300;
/** A new video starts with at most this many seconds selected */
const DEFAULT_CLIP = 8;

function VideoToGif() {
  const t = useT();
  const g = t.videoGif;
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState<string>();
  const [duration, setDuration] = useState(0);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [playable, setPlayable] = useState(true);
  const [opts, setOpts] = useState<GifOptions>({ start: 0, end: 0, width: 480, fps: 12, speed: 1, loop: true, quality: 'balanced' });
  const [state, setState] = useState<{ phase: 'idle' | 'download' | 'encode'; ratio: number }>({ phase: 'idle', ratio: 0 });
  const [result, setResult] = useState<{ blob: Blob; url: string; opts: GifOptions } | null>(null);
  const [failed, setFailed] = useState(false);
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!file) return;
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  useEffect(
    () => () => {
      if (result) URL.revokeObjectURL(result.url);
    },
    [result],
  );

  const load = (f: File) => {
    setFile(f);
    setResult(null);
    setFailed(false);
    setDuration(0);
    setPlayable(true);
  };

  const applyDuration = (d: number) => {
    setDuration(d);
    setOpts((o) => ({ ...o, start: 0, end: Math.min(d, DEFAULT_CLIP) }));
  };

  // Keep playback inside the chosen clip
  const onTime = () => {
    const v = video.current;
    if (v && duration && (v.currentTime > opts.end || v.currentTime < opts.start - 0.05)) v.currentTime = opts.start;
  };

  const set = (patch: Partial<GifOptions>) => setOpts((o) => ({ ...o, ...patch }));
  const setStart = (s: number) => {
    const start = Math.max(0, Math.min(s, opts.end - 0.1));
    set({ start });
    if (video.current) video.current.currentTime = start;
  };
  const setEnd = (e: number) => {
    const end = Math.min(duration, Math.max(e, opts.start + 0.1));
    set({ end });
    if (video.current) video.current.currentTime = Math.max(opts.start, end - 0.5);
  };

  const make = async () => {
    setFailed(false);
    setState({ phase: 'download', ratio: 0 });
    try {
      const blob = await videoToGif(
        file!,
        opts,
        (r) => setState({ phase: 'encode', ratio: r }),
        (r) => setState({ phase: r < 1 ? 'download' : 'encode', ratio: r < 1 ? r : 0 }),
      );
      setResult({ blob, url: URL.createObjectURL(blob), opts });
    } catch {
      setFailed(true);
    }
    setState({ phase: 'idle', ratio: 0 });
  };

  if (!file) {
    return (
      <div className="space-y-4">
        <DropZone onFiles={(f) => load(f[0])} accept="video/*,.mkv,.avi,.mov" multiple={false} hint={g.dropHint} />
        <p className="text-sm text-muted">
          <Rich text={g.intro} />
        </p>
      </div>
    );
  }

  const ready = !playable || duration > 0;
  const frames = frameCount(opts);
  const outW = opts.width && size.w ? Math.min(opts.width, size.w) : size.w;
  const outH = outW && size.w ? Math.round((size.h * outW) / size.w / 2) * 2 : 0;
  const busy = state.phase !== 'idle';
  const stale = result && JSON.stringify(result.opts) !== JSON.stringify(opts);
  const pct = (v: number) => `${(v / (duration || 1)) * 100}%`;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="panel min-w-0 space-y-4 self-start p-4">
        <div className="min-w-0">
          <h3 className="truncate font-mono text-sm" title={file.name}>
            {file.name}
          </h3>
          <p className="mt-1 text-sm text-muted">
            {duration ? `${formatTime(duration)} · ${size.w}×${size.h} · ` : ''}
            {formatBytes(file.size)}
          </p>
        </div>

        <div className="space-y-2 border-t border-line pt-4">
          <label className="label" htmlFor="vg-width">
            {g.width}
          </label>
          <Select
            id="vg-width"
            value={String(opts.width)}
            onChange={(v) => set({ width: Number(v) })}
            options={[
              ['320', '320px'],
              ['480', '480px'],
              ['640', '640px'],
              ['800', '800px'],
              ['0', g.original],
            ]}
          />
        </div>
        <div className="space-y-2">
          <span className="label block">{g.fps}</span>
          <Segmented
            label={g.fps}
            value={String(opts.fps) as '8' | '12' | '15' | '24'}
            onChange={(v) => set({ fps: Number(v) })}
            options={[
              ['8', '8'],
              ['12', '12'],
              ['15', '15'],
              ['24', '24'],
            ]}
          />
        </div>
        <div className="space-y-2">
          <span className="label block">{g.speed}</span>
          <Segmented
            label={g.speed}
            value={String(opts.speed) as '0.5' | '1' | '1.5' | '2'}
            onChange={(v) => set({ speed: Number(v) })}
            options={[
              ['0.5', '0.5×'],
              ['1', '1×'],
              ['1.5', '1.5×'],
              ['2', '2×'],
            ]}
          />
        </div>
        <div className="space-y-2">
          <span className="label block">{g.quality}</span>
          <Segmented
            label={g.quality}
            value={opts.quality}
            onChange={(quality: GifQuality) => set({ quality })}
            options={[
              ['small', g.qualities.small],
              ['balanced', g.qualities.balanced],
              ['high', g.qualities.high],
            ]}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={opts.loop} onChange={(e) => set({ loop: e.target.checked })} />
          {g.loop}
        </label>

        <div className="space-y-2 border-t border-line pt-4">
          <p className="text-sm">
            <Rich text={g.summary(formatTime((opts.end - opts.start) / opts.speed), frames, outW ? `${outW}×${outH}` : '')} />
          </p>
          {frames > MANY_FRAMES && (
            <p className="flex items-start gap-1.5 text-xs text-danger">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              {g.manyFrames}
            </p>
          )}
          {busy ? (
            <div className="space-y-1">
              <div className="flex h-9 items-center gap-3" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(state.ratio * 100)}>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-panel-2">
                  <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${state.ratio * 100}%` }} />
                </div>
                <span className="font-mono text-xs text-muted">{Math.floor(state.ratio * 100)}%</span>
              </div>
              <p className="text-xs text-muted">{state.phase === 'download' ? g.downloading : g.encoding}</p>
            </div>
          ) : (
            <button type="button" className="btn btn-primary w-full" disabled={!ready || opts.end <= opts.start} onClick={make}>
              <Film size={15} strokeWidth={2.2} />
              {result ? g.remake : g.make}
            </button>
          )}
          {failed && <p className="text-sm text-danger">{g.failed}</p>}
          <button type="button" className="btn w-full" disabled={busy} onClick={() => setFile(null)}>
            {g.otherVideo}
          </button>
          <p className="text-xs text-muted">{g.engineNote}</p>
        </div>
      </aside>

      <section className="min-w-0 space-y-3">
        <div className="panel overflow-hidden">
          {playable ? (
            <video
              ref={video}
              src={url}
              className="max-h-[55vh] w-full bg-panel-2"
              controls
              muted
              playsInline
              onLoadedMetadata={(e) => {
                const v = e.currentTarget;
                setSize({ w: v.videoWidth, h: v.videoHeight });
                if (Number.isFinite(v.duration)) applyDuration(v.duration);
                // Recordings made in a browser (MediaRecorder WebM) often carry no duration: seeking far
                // past the end makes the browser work it out, reported through durationchange
                else v.currentTime = 1e101;
              }}
              onDurationChange={(e) => {
                const v = e.currentTarget;
                if (!duration && Number.isFinite(v.duration) && v.duration > 0) {
                  applyDuration(v.duration);
                  v.currentTime = 0;
                }
              }}
              onTimeUpdate={onTime}
              onError={() => {
                // Not playable here (e.g. AVI): no trimming, ffmpeg still reads the first seconds
                setPlayable(false);
                setOpts((o) => ({ ...o, start: 0, end: DEFAULT_CLIP }));
              }}
            />
          ) : (
            <p className="p-6 text-center text-sm text-muted">{g.noPreview}</p>
          )}
          {duration > 0 && (
            <div className="space-y-3 border-t border-line p-4">
              {/* Two range inputs share one track: the thumbs take the pointer, the track does not */}
              <div className="relative h-9">
                <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-panel-2" />
                <div className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-accent" style={{ left: pct(opts.start), width: pct(opts.end - opts.start) }} />
                {(['start', 'end'] as const).map((k) => (
                  <input
                    key={k}
                    type="range"
                    min={0}
                    max={duration}
                    step={0.1}
                    value={opts[k]}
                    onChange={(e) => (k === 'start' ? setStart : setEnd)(Number(e.target.value))}
                    aria-label={k === 'start' ? g.start : g.end}
                    className="pointer-events-none absolute inset-0 w-full appearance-none bg-transparent accent-accent [&::-moz-range-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:pointer-events-auto"
                  />
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="flex items-center gap-2">
                  <span className="text-muted">{g.start}</span>
                  <span className="font-mono">{formatTime(opts.start)}</span>
                  <button type="button" className="btn h-8 px-3 text-xs" onClick={() => video.current && setStart(video.current.currentTime)}>
                    {g.fromHere}
                  </button>
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-muted">{g.end}</span>
                  <span className="font-mono">{formatTime(opts.end)}</span>
                  <button type="button" className="btn h-8 px-3 text-xs" onClick={() => video.current && setEnd(video.current.currentTime)}>
                    {g.toHere}
                  </button>
                </span>
              </div>
            </div>
          )}
        </div>

        {result && (
          <figure className="panel space-y-3 p-4">
            <div className="grid place-items-center rounded-xl bg-[repeating-conic-gradient(var(--color-panel-2)_0_25%,transparent_0_50%)] bg-[length:16px_16px] p-2">
              <img src={result.url} alt={g.result} className={`max-h-[50vh] max-w-full ${stale ? 'opacity-50' : ''}`} />
            </div>
            <figcaption className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm">
                <span className="font-medium">{formatBytes(result.blob.size)}</span>
                <span className="text-muted"> · {g.framesOf(frameCount(result.opts))}</span>
                {stale && <span className="text-muted"> · {g.stale}</span>}
              </span>
              <button type="button" className="btn btn-primary" onClick={() => downloadBlob(result.blob, `${file.name.replace(/\.[^.]+$/, '')}.gif`)}>
                <Download size={15} strokeWidth={2.2} />
                {g.download}
              </button>
            </figcaption>
          </figure>
        )}
        {busy && !result && (
          <p className="panel flex items-center justify-center gap-2 p-6 text-sm text-muted">
            <LoaderCircle size={16} className="animate-spin" />
            {state.phase === 'download' ? g.downloading : g.encoding}
          </p>
        )}
      </section>
    </div>
  );
}

export default withI18n(VideoToGif);
