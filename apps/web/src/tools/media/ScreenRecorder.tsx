import { useEffect, useRef, useState } from 'react';
import { Circle, Download, Film, Pause, Play, RotateCcw, Square } from 'lucide-react';
import Segmented from '../../components/ui/Segmented';
import { useLang, useT, withI18n } from '../../i18n';
import Rich from '../../i18n/Rich';
import { downloadBlob, formatBytes, timestampForFilename } from '../../lib/files';
import { BITRATE, canRecordScreen, clock, finishWebm, mimeFor, startCapture, type Capture, type RecFormat, type RecQuality } from '../../lib/screenRecord';
import { getTool, toolUrl } from '../../tools/registry';

type Phase = 'idle' | 'recording' | 'paused' | 'saving' | 'done';

function ScreenRecorder() {
  const t = useT();
  const r = t.recorder;
  const lang = useLang();
  const [supported] = useState(canRecordScreen);
  const formats = (['mp4', 'webm'] as RecFormat[]).filter((f) => mimeFor(f));
  const [format, setFormat] = useState<RecFormat>(formats[0] ?? 'webm');
  const [quality, setQuality] = useState<RecQuality>('standard');
  const [systemAudio, setSystemAudio] = useState(true);
  const [mic, setMic] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [bytes, setBytes] = useState(0);
  const [result, setResult] = useState<{ blob: Blob; url: string; seconds: number } | null>(null);
  const [notice, setNotice] = useState<'micDenied' | 'failed' | null>(null);

  const capture = useRef<Capture | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  // Time accounting that survives pauses: total so far plus the start of the running stretch
  const clockRef = useRef({ total: 0, since: 0 });
  const live = useRef<HTMLVideoElement>(null);

  const seconds = () => (clockRef.current.total + (clockRef.current.since ? performance.now() - clockRef.current.since : 0)) / 1000;

  useEffect(() => {
    if (phase !== 'recording') return;
    const id = setInterval(() => setElapsed(seconds()), 250);
    return () => clearInterval(id);
  }, [phase]);
  // Leaving the page ends sharing; a replaced recording frees its object URL
  useEffect(() => () => capture.current?.stop(), []);
  useEffect(
    () => () => {
      if (result) URL.revokeObjectURL(result.url);
    },
    [result],
  );

  const start = async () => {
    setNotice(null);
    let cap: Capture;
    try {
      cap = await startCapture({ systemAudio, mic });
    } catch (e) {
      // Closing the picker is not an error worth showing
      if ((e as DOMException)?.name !== 'NotAllowedError' && (e as DOMException)?.name !== 'AbortError') setNotice('failed');
      return;
    }
    if (cap.micDenied) setNotice('micDenied');
    capture.current = cap;
    const mimeType = mimeFor(format);
    const rec = new MediaRecorder(cap.stream, { mimeType, videoBitsPerSecond: BITRATE[quality], audioBitsPerSecond: 128_000 });
    chunks.current = [];
    setBytes(0);
    rec.ondataavailable = (e) => {
      if (e.data.size) {
        chunks.current.push(e.data);
        setBytes((n) => n + e.data.size);
      }
    };
    rec.onstop = async () => {
      setPhase('saving');
      const total = seconds();
      clockRef.current = { total: 0, since: 0 };
      cap.stop();
      capture.current = null;
      let blob = new Blob(chunks.current, { type: (rec.mimeType || mimeType || 'video/webm').split(';')[0] });
      chunks.current = [];
      blob = await finishWebm(blob, total * 1000);
      setResult({ blob, url: URL.createObjectURL(blob), seconds: total });
      setPhase('done');
    };
    // The browser's own "Stop sharing" button ends the video track
    cap.stream.getVideoTracks()[0]?.addEventListener('ended', () => rec.state !== 'inactive' && rec.stop());
    recorder.current = rec;
    clockRef.current = { total: 0, since: performance.now() };
    setElapsed(0);
    rec.start(1000);
    setPhase('recording');
  };

  // Show what is being recorded
  useEffect(() => {
    if ((phase === 'recording' || phase === 'paused') && live.current && capture.current) {
      live.current.srcObject = capture.current.preview;
      live.current.play().catch(() => {});
    }
  }, [phase]);

  const pause = () => {
    recorder.current?.pause();
    clockRef.current = { total: clockRef.current.total + performance.now() - clockRef.current.since, since: 0 };
    setElapsed(seconds());
    setPhase('paused');
  };
  const resume = () => {
    recorder.current?.resume();
    clockRef.current = { ...clockRef.current, since: performance.now() };
    setPhase('recording');
  };
  const stop = () => {
    if (recorder.current?.state === 'paused') clockRef.current = { ...clockRef.current, since: 0 };
    recorder.current?.stop();
  };

  if (!supported) {
    return (
      <div className="panel space-y-2 p-6">
        <p className="font-medium">{r.unsupported}</p>
        <p className="text-sm text-muted">{r.unsupportedNote}</p>
      </div>
    );
  }

  const ext = result?.blob.type.includes('mp4') ? 'mp4' : 'webm';

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="panel min-w-0 space-y-4 self-start p-4">
        <fieldset className="space-y-4" disabled={phase !== 'idle' && phase !== 'done'}>
          {formats.length > 1 && (
            <div className="space-y-2">
              <span className="label block">{r.format}</span>
              <Segmented
                label={r.format}
                value={format}
                onChange={setFormat}
                options={formats.map((f) => [f, f === 'mp4' ? r.formats.mp4 : r.formats.webm] as const)}
              />
            </div>
          )}
          <div className="space-y-2">
            <span className="label block">{r.quality}</span>
            <Segmented
              label={r.quality}
              value={quality}
              onChange={setQuality}
              options={[
                ['small', r.qualities.small],
                ['standard', r.qualities.standard],
                ['high', r.qualities.high],
              ]}
            />
          </div>
          <div className="space-y-2 border-t border-line pt-4 text-sm">
            <label className="flex items-start gap-2">
              <input type="checkbox" className="mt-1" checked={systemAudio} onChange={(e) => setSystemAudio(e.target.checked)} />
              <span>
                {r.systemAudio}
                <span className="block text-xs text-muted">{r.systemAudioNote}</span>
              </span>
            </label>
            <label className="flex items-start gap-2">
              <input type="checkbox" className="mt-1" checked={mic} onChange={(e) => setMic(e.target.checked)} />
              <span>{r.mic}</span>
            </label>
          </div>
        </fieldset>
        <p className="border-t border-line pt-4 text-xs text-muted">
          <Rich text={r.privacy} />
        </p>
      </aside>

      <section className="min-w-0 space-y-3">
        {phase === 'idle' && (
          <div className="panel grid place-items-center gap-4 px-6 py-14 text-center">
            <span className="grid size-16 place-items-center rounded-full bg-danger/12 text-danger">
              <Circle size={28} fill="currentColor" />
            </span>
            <p className="max-w-md text-sm text-muted">
              <Rich text={r.intro} />
            </p>
            <button type="button" className="btn btn-primary px-6" onClick={start}>
              {r.start}
            </button>
          </div>
        )}

        {(phase === 'recording' || phase === 'paused') && (
          <div className="panel overflow-hidden">
            <video ref={live} className="max-h-[50vh] w-full bg-panel-2" muted playsInline />
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line py-2 pr-2 pl-4">
              <span className="flex items-center gap-2 font-mono text-sm" aria-live="off">
                <span className={`size-2.5 rounded-full ${phase === 'recording' ? 'animate-pulse bg-danger' : 'bg-muted'}`} />
                {clock(elapsed)}
                <span className="text-muted">· {formatBytes(bytes)}</span>
                {phase === 'paused' && <span className="text-muted">· {r.paused}</span>}
              </span>
              <span className="flex gap-2">
                {phase === 'recording' ? (
                  <button type="button" className="btn" onClick={pause}>
                    <Pause size={15} />
                    {r.pause}
                  </button>
                ) : (
                  <button type="button" className="btn" onClick={resume}>
                    <Play size={15} />
                    {r.resume}
                  </button>
                )}
                <button type="button" className="btn btn-primary" onClick={stop}>
                  <Square size={14} fill="currentColor" />
                  {r.stop}
                </button>
              </span>
            </div>
          </div>
        )}

        {phase === 'saving' && <p className="panel p-6 text-center text-sm text-muted">{r.saving}</p>}

        {phase === 'done' && result && (
          <div className="panel overflow-hidden">
            <video src={result.url} className="max-h-[55vh] w-full bg-panel-2" controls playsInline />
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line py-2 pr-2 pl-4">
              <span className="text-sm">
                <span className="font-medium">{clock(result.seconds)}</span>
                <span className="text-muted">
                  {' '}
                  · {formatBytes(result.blob.size)} · {ext.toUpperCase()}
                </span>
              </span>
              <span className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setResult(null);
                    setPhase('idle');
                  }}
                >
                  <RotateCcw size={15} />
                  {r.again}
                </button>
                <button type="button" className="btn btn-primary" onClick={() => downloadBlob(result.blob, `screen-recording-${timestampForFilename()}.${ext}`)}>
                  <Download size={15} strokeWidth={2.2} />
                  {r.download}
                </button>
              </span>
            </div>
          </div>
        )}

        {phase === 'done' && getTool('video-to-gif') && (
          <p className="flex items-center gap-2 px-1 text-sm text-muted">
            <Film size={15} className="shrink-0" />
            <span>
              {r.gifTip}{' '}
              <a className="text-accent underline" href={toolUrl('video-to-gif', lang)}>
                {t.tools['video-to-gif'].name}
              </a>
            </span>
          </p>
        )}

        {notice && <p className="panel p-4 text-sm text-danger">{r.notices[notice]}</p>}
      </section>
    </div>
  );
}

export default withI18n(ScreenRecorder);
