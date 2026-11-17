import { useEffect, useMemo, useRef, useState } from 'react';
import { Eye, EyeOff, Play, RotateCcw, Shuffle, Trophy } from 'lucide-react';
import Segmented from '../../components/ui/Segmented';
import TextPanel from '../../components/ui/TextPanel';
import { useT, withI18n } from '../../i18n';
import { BOARD, hue, makeLadder, makePegs, parseEntries, rouletteSpin, shuffle, spawnBalls, stepBalls, tracePath, type Ball } from '../../lib/draw';

type Game = 'roulette' | 'ladder' | 'pinball';

function DrawGames() {
  const t = useT();
  const d = t.draw;
  const [game, setGame] = useState<Game>('roulette');
  const [text, setText] = useState(d.sample.join('\n'));
  const entries = useMemo(() => parseEntries(text), [text]);

  return (
    <div className="space-y-4">
      <Segmented
        label={d.game}
        value={game}
        onChange={setGame}
        options={[
          ['roulette', d.games.roulette],
          ['ladder', d.games.ladder],
          ['pinball', d.games.pinball],
        ]}
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <div className="min-w-0 space-y-3">
          <TextPanel
            label={d.entries(entries.length)}
            value={text}
            onChange={setText}
            placeholder={d.entriesPlaceholder}
            minHeight="min-h-48"
            actions={
              <button type="button" className="btn" title={d.shuffle} aria-label={d.shuffle} onClick={() => setText(shuffle(entries).join('\n'))}>
                <Shuffle size={15} />
              </button>
            }
          />
          <p className="px-1 text-xs text-muted">{d.entriesNote}</p>
        </div>
        <div className="min-w-0">
          {entries.length < 2 ? (
            <p className="panel p-6 text-center text-sm text-muted">{d.needTwo}</p>
          ) : game === 'roulette' ? (
            <Roulette entries={entries} onRemove={(index) => setText(entries.filter((_, i) => i !== index).join('\n'))} />
          ) : game === 'ladder' ? (
            <Ladder entries={entries} />
          ) : (
            <Pinball entries={entries} />
          )}
        </div>
      </div>
    </div>
  );
}

const reducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ------------------------------------------------------------------ */
/* Roulette                                                            */
/* ------------------------------------------------------------------ */

function Roulette({ entries, onRemove }: { entries: string[]; onRemove: (index: number) => void }) {
  const d = useT().draw;
  const [angle, setAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<number | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const n = entries.length;
  const R = 150;
  const seg = 360 / n;
  const point = (deg: number, r: number) => {
    const a = ((deg - 90) * Math.PI) / 180;
    return [160 + r * Math.cos(a), 160 + r * Math.sin(a)];
  };

  // A new list resets the wheel's result
  useEffect(() => setWinner(null), [entries.join('\n')]);

  const spin = () => {
    const s = rouletteSpin(n, angle);
    setWinner(null);
    setSpinning(true);
    setAngle(s.angle);
    // The result shows once the wheel has stopped (the spin lasts 5 s, or no time with reduced motion)
    window.setTimeout(
      () => {
        setSpinning(false);
        setWinner(s.winner);
        setHistory((h) => [entries[s.winner], ...h].slice(0, 10));
      },
      reducedMotion() ? 50 : 5200,
    );
  };

  return (
    <div className="panel space-y-4 p-4">
      <div className="relative mx-auto w-full max-w-[360px]">
        <svg viewBox="0 0 320 320" className="w-full" role="img" aria-label={d.games.roulette}>
          <g
            style={{
              transform: `rotate(${-angle}deg)`,
              transformOrigin: '160px 160px',
              transition: spinning ? `transform ${reducedMotion() ? 0 : 5}s cubic-bezier(0.12, 0.7, 0.1, 1)` : 'none',
            }}
          >
            {entries.map((name, i) => {
              const [x1, y1] = point(i * seg, R);
              const [x2, y2] = point((i + 1) * seg, R);
              const mid = i * seg + seg / 2;
              const [tx, ty] = point(mid, R * 0.62);
              return (
                <g key={i}>
                  <path d={`M160 160 L${x1} ${y1} A${R} ${R} 0 ${seg > 180 ? 1 : 0} 1 ${x2} ${y2} Z`} fill={hue(i, n)} stroke="var(--panel)" strokeWidth={1.5} />
                  <text
                    x={tx}
                    y={ty}
                    fill="#fff"
                    fontSize={n > 12 ? 10 : 13}
                    fontWeight={600}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    transform={`rotate(${mid > 180 ? mid + 90 : mid - 90} ${tx} ${ty})`}
                  >
                    {name.length > 10 ? name.slice(0, 9) + '…' : name}
                  </text>
                </g>
              );
            })}
          </g>
          <circle cx={160} cy={160} r={18} fill="var(--panel)" stroke="var(--line)" />
          {/* Pointer at the top */}
          <path d="M160 26 L148 4 L172 4 Z" fill="var(--fg)" />
        </svg>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button type="button" className="btn btn-primary px-8" disabled={spinning} onClick={spin}>
          <Play size={15} />
          {d.spin}
        </button>
        {winner !== null && !spinning && (
          <button type="button" className="btn" onClick={() => onRemove(winner)}>
            {d.removeWinner}
          </button>
        )}
      </div>
      <p className="min-h-8 text-center text-lg font-semibold" aria-live="polite" data-result>
        {winner !== null && !spinning && (
          <span className="inline-flex items-center gap-2">
            <Trophy size={18} className="text-accent" />
            {d.winner(entries[winner])}
          </span>
        )}
      </p>
      {history.length > 1 && <p className="text-center text-xs text-muted">{d.history(history.slice(1).join(', '))}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Ladder                                                              */
/* ------------------------------------------------------------------ */

function Ladder({ entries }: { entries: string[] }) {
  const d = useT().draw;
  const n = entries.length;
  const [resultsText, setResultsText] = useState(() => [d.prize, ...Array(Math.max(0, n - 1)).fill(d.blank)].join(', '));
  const [rungs, setRungs] = useState(() => makeLadder(n));
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [hide, setHide] = useState(true);

  const parsed = parseEntries(resultsText);
  const results = Array.from({ length: n }, (_, i) => parsed[i] ?? d.blank);
  useEffect(() => {
    setRungs(makeLadder(n));
    setRevealed(new Set());
  }, [n]);

  const W = 320;
  const H = 300;
  const top = 10;
  const bottom = H - 10;
  // Column lines sit at the centers of the name and result cells above and below
  const colX = (c: number) => ((c + 0.5) * W) / n;
  const rowY = (r: number) => top + ((r + 1) * (bottom - top)) / (rungs.length + 1);
  const paths = useMemo(() => entries.map((_, i) => tracePath(rungs, i)), [rungs, entries.length]);

  /** Polyline points for a path: down each column, across at each rung */
  const points = (p: number[]) => {
    const pts: [number, number][] = [[colX(p[0]), top]];
    for (let r = 0; r < rungs.length; r++) {
      const y = rowY(r);
      pts.push([colX(p[r]), y]);
      if (p[r + 1] !== p[r]) pts.push([colX(p[r + 1]), y]);
    }
    pts.push([colX(p[p.length - 1]), bottom]);
    return pts;
  };
  const length = (pts: [number, number][]) => pts.slice(1).reduce((s, [x, y], i) => s + Math.hypot(x - pts[i][0], y - pts[i][1]), 0);

  const regenerate = () => {
    setRungs(makeLadder(n));
    setRevealed(new Set());
  };

  return (
    <div className="panel space-y-4 p-4">
      <div className="space-y-1">
        <label className="label" htmlFor="ladder-results">
          {d.results}
        </label>
        <input id="ladder-results" className="input w-full" value={resultsText} onChange={(e) => setResultsText(e.target.value)} />
        {parsed.length !== n && <p className="text-xs text-muted">{d.resultsNote(n)}</p>}
      </div>

      <div className="overflow-x-auto">
        <div className="mx-auto" style={{ minWidth: Math.max(280, n * 56), maxWidth: 560 }}>
          <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
            {entries.map((name, i) => (
              <button
                key={i}
                type="button"
                className={`truncate rounded-full px-2 py-1.5 text-xs font-medium text-white ${revealed.has(i) ? '' : 'opacity-90 hover:opacity-100'}`}
                style={{ background: hue(i, n) }}
                onClick={() => setRevealed((s) => new Set(s).add(i))}
                title={name}
              >
                {name}
              </button>
            ))}
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={d.games.ladder}>
            {entries.map((_, c) => (
              <line key={c} x1={colX(c)} y1={top} x2={colX(c)} y2={bottom} stroke="var(--line)" strokeWidth={3} />
            ))}
            {rungs.map((row, r) => row.map((on, c) => on && <line key={`${r}-${c}`} x1={colX(c)} y1={rowY(r)} x2={colX(c + 1)} y2={rowY(r)} stroke="var(--line)" strokeWidth={3} />))}
            {[...revealed].map((i) => {
              const pts = points(paths[i]);
              const len = length(pts);
              return (
                <polyline
                  key={i}
                  points={pts.map((p) => p.join(',')).join(' ')}
                  fill="none"
                  stroke={hue(i, n)}
                  strokeWidth={5}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  strokeDasharray={len}
                  strokeDashoffset={len}
                  style={{ animation: reducedMotion() ? 'none' : 'ladder-draw 1.6s ease-in-out forwards', strokeDashoffset: reducedMotion() ? 0 : undefined }}
                />
              );
            })}
          </svg>
          <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
            {results.map((res, c) => {
              const from = paths.findIndex((p) => p[p.length - 1] === c);
              const shown = !hide || revealed.has(from);
              return (
                <span
                  key={c}
                  className={`truncate rounded-full px-2 py-1.5 text-center text-xs font-medium ${shown ? 'bg-panel-2' : 'bg-panel-2 text-transparent'}`}
                  style={shown && revealed.has(from) ? { boxShadow: `inset 0 0 0 2px ${hue(from, n)}` } : undefined}
                  title={shown ? res : ''}
                  data-result-col={c}
                >
                  {shown ? res : '?'}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <button type="button" className="btn btn-primary" onClick={() => setRevealed(new Set(entries.map((_, i) => i)))}>
          <Eye size={15} />
          {d.revealAll}
        </button>
        <button type="button" className="btn" onClick={() => setHide((h) => !h)}>
          {hide ? <Eye size={15} /> : <EyeOff size={15} />}
          {hide ? d.showResults : d.hideResults}
        </button>
        <button type="button" className="btn" onClick={regenerate}>
          <RotateCcw size={15} />
          {d.newLadder}
        </button>
      </div>
      {revealed.size > 0 && (
        <ul className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-2" aria-live="polite">
          {[...revealed].map((i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: hue(i, n) }} />
              <span className="min-w-0 truncate">{d.ladderResult(entries[i], results[paths[i][paths[i].length - 1]])}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-center text-xs text-muted">{d.ladderHint}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pinball                                                             */
/* ------------------------------------------------------------------ */

function Pinball({ entries }: { entries: string[] }) {
  const d = useT().draw;
  const n = entries.length;
  const canvas = useRef<HTMLCanvasElement>(null);
  const [order, setOrder] = useState<number[]>([]);
  const [running, setRunning] = useState(false);
  const [lastWins, setLastWins] = useState(false);
  const pegs = useMemo(() => makePegs(), []);
  const balls = useRef<Ball[]>([]);
  const frame = useRef(0);

  const draw = () => {
    const c = canvas.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    const css = getComputedStyle(document.documentElement);
    const ratio = window.devicePixelRatio || 1;
    if (c.width !== BOARD.w * ratio) {
      c.width = BOARD.w * ratio;
      c.height = BOARD.h * ratio;
    }
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, BOARD.w, BOARD.h);
    ctx.fillStyle = css.getPropertyValue('--muted').trim() || '#888';
    for (const p of pegs) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = css.getPropertyValue('--accent').trim() || '#0a84ff';
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(0, BOARD.finish);
    ctx.lineTo(BOARD.w, BOARD.finish);
    ctx.stroke();
    ctx.setLineDash([]);
    for (const b of balls.current) {
      if (b.finished !== null) continue;
      ctx.fillStyle = hue(b.index, n);
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = `600 ${b.r + 2}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText([...entries[b.index]][0] ?? '', b.x, b.y + 0.5);
    }
  };

  useEffect(() => {
    draw();
  }, [entries.join('\n')]);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const start = () => {
    cancelAnimationFrame(frame.current);
    balls.current = spawnBalls(n);
    setOrder([]);
    setRunning(true);
    const finished: number[] = [];
    let clock = 0;
    let last = performance.now();
    const speed = reducedMotion() ? 4 : 1;
    const tick = (now: number) => {
      // Fixed small steps keep the physics stable whatever the frame rate
      const elapsed = Math.min(0.05, (now - last) / 1000) * speed;
      last = now;
      const steps = Math.ceil(elapsed * 480);
      for (let s = 0; s < steps; s++) {
        clock += 1 / 480;
        const done = stepBalls(balls.current, pegs, 1 / 480, clock);
        if (done.length) {
          finished.push(...done);
          setOrder([...finished]);
        }
      }
      draw();
      if (finished.length < n && clock < 60) frame.current = requestAnimationFrame(tick);
      else setRunning(false);
    };
    frame.current = requestAnimationFrame(tick);
  };

  const done = !running && order.length === n;
  const winner = done ? order[lastWins ? n - 1 : 0] : null;

  return (
    <div className="panel grid grid-cols-1 gap-4 p-4 sm:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
      <canvas ref={canvas} className="w-full rounded-2xl bg-panel-2" style={{ aspectRatio: `${BOARD.w} / ${BOARD.h}` }} role="img" aria-label={d.games.pinball} />
      <div className="min-w-0 space-y-3">
        <Segmented
          label={d.whoWins}
          value={lastWins ? 'last' : 'first'}
          onChange={(v) => setLastWins(v === 'last')}
          options={[
            ['first', d.firstWins],
            ['last', d.lastWins],
          ]}
        />
        <button type="button" className="btn btn-primary w-full" disabled={running} onClick={start}>
          <Play size={15} />
          {order.length ? d.again : d.drop}
        </button>
        <p className="min-h-7 text-lg font-semibold" aria-live="polite" data-result>
          {winner !== null && (
            <span className="inline-flex items-center gap-2">
              <Trophy size={18} className="text-accent" />
              {d.winner(entries[winner])}
            </span>
          )}
        </p>
        <ol className="space-y-1 text-sm">
          {order.map((i, rank) => (
            <li key={i} className={`flex items-center gap-2 ${i === winner ? 'font-semibold' : ''}`}>
              <span className="w-6 text-right font-mono text-xs text-muted">{rank + 1}</span>
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: hue(i, n) }} />
              <span className="min-w-0 truncate">{entries[i]}</span>
            </li>
          ))}
        </ol>
        <p className="text-xs text-muted">{d.pinballHint}</p>
      </div>
    </div>
  );
}

export default withI18n(DrawGames);
