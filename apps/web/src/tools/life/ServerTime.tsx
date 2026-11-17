import { useEffect, useRef, useState } from 'react';
import { AlarmClock, Cloud, LoaderCircle, RefreshCw, Volume2, VolumeX, X } from 'lucide-react';
import { LANG_TAGS, useLang, useT, withI18n } from '../../i18n';
import Rich from '../../i18n/Rich';
import { ClockFailure, forgetSites, giveConsent, hasConsent, measureSite, recentSites, rememberSite, type ClockError, type SiteClock } from '../../lib/serverClock';

const pad = (n: number, w = 2) => String(n).padStart(w, '0');

/** Time of day of an epoch-ms value in this device's time zone, with hundredths */
function parts(ms: number) {
  const d = new Date(ms);
  return { hms: `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`, cs: pad(Math.floor(d.getMilliseconds() / 10)) };
}

/** Short beeps for the countdown (Web Audio, no files) */
function beep(ctx: AudioContext, long = false) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.frequency.value = long ? 1320 : 880;
  g.gain.setValueAtTime(0.25, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (long ? 0.6 : 0.15));
  o.connect(g).connect(ctx.destination);
  o.start();
  o.stop(ctx.currentTime + (long ? 0.6 : 0.15));
}

function ServerTime() {
  const t = useT();
  const s = t.serverTime;
  const lang = useLang();
  const [url, setUrl] = useState('');
  const [clock, setClock] = useState<SiteClock | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ClockError | null>(null);
  const [asking, setAsking] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [alarm, setAlarm] = useState('');
  const [sound, setSound] = useState(true);
  const [, setTick] = useState(0);
  const audio = useRef<AudioContext | null>(null);
  const lastBeep = useRef<number | null>(null);

  useEffect(() => setRecent(recentSites()), []);

  // Redraw every frame while a clock is shown
  useEffect(() => {
    if (!clock) return;
    let id = 0;
    const loop = () => {
      setTick((n) => n + 1);
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [clock]);

  const check = async (target = url) => {
    if (!target.trim()) return;
    // Browsers allow sound only after a user action: this click is one, so open the audio context now
    try {
      audio.current ??= new AudioContext();
    } catch {
      /* no audio */
    }
    if (!hasConsent()) {
      setAsking(true);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const c = await measureSite(target);
      setClock(c);
      rememberSite(c.host);
      setRecent(recentSites());
    } catch (e) {
      setError(e instanceof ClockFailure ? e.code : 'offline');
    }
    setBusy(false);
  };

  const siteNow = clock ? Date.now() + clock.offset : 0;
  const { hms, cs } = parts(siteNow);
  const diff = clock ? clock.offset / 1000 : 0;

  // Countdown to the alarm time (today, or tomorrow if it has passed)
  let left: number | null = null;
  if (clock && /^\d{2}:\d{2}(:\d{2})?$/.test(alarm)) {
    const [h, m, sec = 0] = alarm.split(':').map(Number);
    const d = new Date(siteNow);
    d.setHours(h, m, sec, 0);
    if (d.getTime() < siteNow - 2000) d.setDate(d.getDate() + 1);
    left = d.getTime() - siteNow;
  }
  useEffect(() => {
    if (left === null || !sound || !audio.current) return;
    const secs = Math.ceil(left / 1000);
    if (secs <= 3 && secs >= 0 && lastBeep.current !== secs) {
      lastBeep.current = secs;
      beep(audio.current, secs === 0);
    }
    if (secs > 3) lastBeep.current = null;
  });

  return (
    <div className="space-y-4">
      <form
        className="panel flex flex-wrap items-center gap-2 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          check();
        }}
      >
        <input
          className="input min-w-0 flex-1 basis-60"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={s.placeholder}
          aria-label={s.address}
          inputMode="url"
          autoComplete="url"
          spellCheck={false}
        />
        <button type="submit" className="btn btn-primary" disabled={busy || !url.trim()}>
          {busy ? <LoaderCircle size={15} className="animate-spin" /> : <RefreshCw size={15} />}
          {busy ? s.checking : clock ? s.recheck : s.check}
        </button>
        {recent.length > 0 && (
          <div className="flex w-full flex-wrap items-center gap-1.5 pt-1">
            {recent.map((h) => (
              <button
                key={h}
                type="button"
                className="rounded-full bg-panel-2 px-3 py-1 text-xs hover:text-accent"
                onClick={() => {
                  setUrl(h);
                  check(h);
                }}
              >
                {h}
              </button>
            ))}
            <button
              type="button"
              className="grid size-6 place-items-center rounded-full text-muted hover:text-fg"
              title={s.clearRecent}
              aria-label={s.clearRecent}
              onClick={() => {
                forgetSites();
                setRecent([]);
              }}
            >
              <X size={13} />
            </button>
          </div>
        )}
      </form>

      {asking && (
        <div className="panel space-y-3 p-4" role="dialog" aria-labelledby="st-consent">
          <p id="st-consent" className="flex items-start gap-2 text-sm">
            <Cloud size={16} className="mt-0.5 shrink-0 text-accent" />
            <span>
              <Rich text={s.consent} />
            </span>
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                giveConsent();
                setAsking(false);
                check();
              }}
            >
              {s.consentOk}
            </button>
            <button type="button" className="btn" onClick={() => setAsking(false)}>
              {s.consentNo}
            </button>
          </div>
        </div>
      )}

      {error && <p className="panel p-4 text-sm text-danger">{s.errors[error]}</p>}

      {clock ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
          <section className="panel space-y-3 p-6 text-center" aria-live="off">
            <p className="text-sm text-muted">{s.timeOf(clock.host)}</p>
            <p className="font-mono text-5xl font-bold tracking-tight tabular-nums sm:text-7xl" data-site-time>
              {hms}
              <span className="text-3xl text-muted sm:text-5xl">.{cs}</span>
            </p>
            <p className="text-sm">
              {Math.abs(diff) < 0.01 ? s.same : diff > 0 ? s.ahead(Math.abs(diff).toFixed(2)) : s.behind(Math.abs(diff).toFixed(2))}
              <span className="text-muted"> · ±{(clock.precision / 1000).toFixed(2)}s</span>
            </p>
            {Math.abs(clock.deviceError) >= 50 && <p className="text-xs text-muted">{s.deviceError(Math.abs(clock.deviceError / 1000).toFixed(2), clock.deviceError < 0)}</p>}
            {left !== null && (
              <p className={`text-2xl font-semibold tabular-nums ${left <= 10_000 ? 'text-danger' : ''}`} data-countdown>
                {left <= 0
                  ? s.now
                  : left >= 3_600_000
                    ? s.left(`${Math.floor(left / 3_600_000)}:${pad(Math.floor((left % 3_600_000) / 60000))}:${pad(Math.floor((left % 60000) / 1000))}`)
                    : s.left(`${Math.floor(left / 60000)}:${pad(Math.floor((left % 60000) / 1000))}.${pad(Math.floor((left % 1000) / 10))}`)}
              </p>
            )}
          </section>
          <aside className="panel space-y-3 self-start p-4">
            <label className="label flex items-center gap-1.5" htmlFor="st-alarm">
              <AlarmClock size={14} />
              {s.alarm}
            </label>
            <input
              id="st-alarm"
              className="input w-full font-mono"
              value={alarm}
              onChange={(e) => setAlarm(e.target.value.replace(/[^\d:]/g, '').slice(0, 8))}
              placeholder="10:00:00"
              inputMode="numeric"
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={sound}
                onChange={(e) => {
                  setSound(e.target.checked);
                  if (e.target.checked) audio.current ??= new AudioContext();
                }}
                onFocus={() => {
                  audio.current ??= new AudioContext();
                }}
              />
              {sound ? <Volume2 size={14} /> : <VolumeX size={14} />}
              {s.sound}
            </label>
            <p className="text-xs text-muted">{s.alarmNote}</p>
          </aside>
        </div>
      ) : (
        !asking && (
          <div className="panel p-6 text-sm text-muted">
            <Rich text={s.intro} />
          </div>
        )
      )}
      <p className="px-1 text-xs text-muted">
        {s.timezone(new Intl.DateTimeFormat(LANG_TAGS[lang], { timeZoneName: 'long' }).formatToParts(new Date()).find((p) => p.type === 'timeZoneName')?.value ?? '')}
      </p>
    </div>
  );
}

export default withI18n(ServerTime);
