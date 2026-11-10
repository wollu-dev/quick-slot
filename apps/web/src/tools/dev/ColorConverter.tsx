import { useRef, useState, type CSSProperties } from 'react';
import { Check, X } from 'lucide-react';
import CopyButton from '../../components/ui/CopyButton';
import { useT, withI18n } from '../../i18n';
import { contrast, hsvToRgb, parseColor, rgbToHsl, rgbToHsv, srgbToLinear, toHex, toHex8, type Hsva, type Rgba } from '../../lib/color';

const f3 = (n: number) => n.toFixed(3);
const pct = (n: number) => `${Math.round(n * 100)}%`;
const deg = (n: number) => `${Math.round(n) % 360}`;

/** Transparency checkerboard drawn with theme tokens */
const CHECKER: CSSProperties = { background: 'repeating-conic-gradient(var(--line) 0 25%, var(--panel) 0 50%) 0 0 / 12px 12px' };

/** Drag handler for a 1D or 2D area: reports the pointer position as 0–1 fractions */
function useDrag(onMove: (x: number, y: number) => void) {
  const ref = useRef<HTMLDivElement>(null);
  const move = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    onMove(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)));
  };
  return {
    ref,
    onPointerDown: (e: React.PointerEvent) => {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      move(e);
    },
    onPointerMove: (e: React.PointerEvent) => e.buttons && move(e),
  };
}

function ColorConverter() {
  const t = useT();
  const c = t.color;
  const [hsva, setHsva] = useState<Hsva>({ h: 210, s: 2 / 3, v: 0.6, a: 1 });
  const [draft, setDraft] = useState<string | null>(null);
  const rgba = hsvToRgb(hsva);
  const parsed = draft === null ? null : parseColor(draft);

  const set = (patch: Partial<Hsva>) => {
    setHsva({ ...hsva, ...patch });
    setDraft(null);
  };
  const onText = (text: string) => {
    setDraft(text);
    const p = parseColor(text);
    if (p) setHsva(rgbToHsv(p, hsva.h));
  };

  const sv = useDrag((x, y) => set({ s: x, v: 1 - y }));
  const hue = useDrag((x) => set({ h: x * 360 }));
  const alpha = useDrag((x) => set({ a: Math.round(x * 100) / 100 }));

  const keyStep = (e: React.KeyboardEvent, apply: (dx: number, dy: number) => void) => {
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key];
    if (!d) return;
    e.preventDefault();
    apply(d[0] * (e.shiftKey ? 10 : 1), d[1] * (e.shiftKey ? 10 : 1));
  };
  const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

  const { r, g, b, a } = rgba;
  const hsl = rgbToHsl(rgba);
  const unit = [r, g, b].map((x) => x / 255);
  const lin = unit.map(srgbToLinear);
  const a255 = Math.round(a * 255);
  const hasAlpha = a < 1;
  const solid = `rgb(${r} ${g} ${b})`;
  const css = `rgb(${r} ${g} ${b} / ${a})`;

  const rows: { group?: string; label: string; value: string }[] = [
    { group: c.web, label: 'HEX', value: hasAlpha ? toHex8(rgba) : toHex(rgba) },
    { label: 'RGB', value: hasAlpha ? `rgba(${r}, ${g}, ${b}, ${a})` : `rgb(${r}, ${g}, ${b})` },
    { label: 'HSL', value: hasAlpha ? `hsla(${deg(hsl.h)}, ${pct(hsl.s)}, ${pct(hsl.l)}, ${a})` : `hsl(${deg(hsl.h)}, ${pct(hsl.s)}, ${pct(hsl.l)})` },
    { label: 'HSV', value: `hsv(${deg(hsva.h)}, ${pct(hsva.s)}, ${pct(hsva.v)})` },
    { group: c.engines, label: 'Unity Color', value: `new Color(${unit.map((x) => `${f3(x)}f`).join(', ')}, ${f3(a)}f)` },
    { label: 'Unity Color32', value: `new Color32(${r}, ${g}, ${b}, ${a255})` },
    { label: 'Unreal FLinearColor', value: `FLinearColor(${lin.map((x) => `${f3(x)}f`).join(', ')}, ${f3(a)}f)` },
    { label: 'Unreal FColor', value: `FColor(${r}, ${g}, ${b}, ${a255})` },
    { label: 'Godot Color', value: `Color(${unit.map(f3).join(', ')}, ${f3(a)})` },
    { group: c.floats, label: c.srgb01, value: [...unit, a].map(f3).join(', ') },
    { label: c.linear01, value: [...lin, a].map(f3).join(', ') },
  ];

  const white: Rgba = { r: 255, g: 255, b: 255, a: 1 };
  const black: Rgba = { r: 0, g: 0, b: 0, a: 1 };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="panel space-y-4 self-start p-4">
        {/* Saturation (x) / brightness (y) area */}
        <div
          {...sv}
          role="slider"
          tabIndex={0}
          aria-label={c.saturationValue}
          aria-valuetext={`${pct(hsva.s)}, ${pct(hsva.v)}`}
          onKeyDown={(e) => keyStep(e, (dx, dy) => set({ s: clamp01(hsva.s + dx / 100), v: clamp01(hsva.v + dy / 100) }))}
          className="relative aspect-[4/3] w-full cursor-crosshair touch-none rounded-2xl outline-none focus-visible:ring-4 focus-visible:ring-accent/30"
          style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hsva.h} 100% 50%))` }}
        >
          <span
            className="pointer-events-none absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white shadow-[0_0_0_1px_rgb(0_0_0/0.3),0_2px_6px_rgb(0_0_0/0.3)]"
            style={{ left: pct(hsva.s), top: pct(1 - hsva.v), background: solid }}
          />
        </div>

        <Bar
          drag={hue}
          label={c.hue}
          value={hsva.h / 360}
          valueText={`${deg(hsva.h)}°`}
          onKey={(e) => keyStep(e, (dx, dy) => set({ h: (hsva.h + dx + dy + 360) % 360 }))}
          background="linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)"
          thumb={`hsl(${hsva.h} 100% 50%)`}
        />
        <Bar
          drag={alpha}
          label={c.alpha}
          value={a}
          valueText={pct(a)}
          onKey={(e) => keyStep(e, (dx, dy) => set({ a: Math.round(clamp01(a + (dx + dy) / 100) * 100) / 100 }))}
          background={`linear-gradient(to right, transparent, ${solid})`}
          checker
          thumb={css}
        />

        <div className="flex items-center gap-3 border-t border-line pt-4">
          <span className="relative size-14 shrink-0 overflow-hidden rounded-[15px] shadow-[inset_0_0_0_1px_var(--line)]" style={CHECKER}>
            <span className="absolute inset-0" style={{ background: css }} />
          </span>
          <div className="min-w-0 flex-1">
            <label className="label" htmlFor="color-input">
              {c.input}
            </label>
            <input
              id="color-input"
              className="input font-mono"
              spellCheck={false}
              autoComplete="off"
              value={draft ?? (hasAlpha ? toHex8(rgba) : toHex(rgba))}
              onChange={(e) => onText(e.target.value)}
              onBlur={() => setDraft(null)}
              aria-invalid={draft !== null && !parsed}
            />
          </div>
        </div>
        <p className={`text-xs ${draft !== null && draft.trim() && !parsed ? 'text-danger' : 'text-muted'}`}>{draft !== null && draft.trim() && !parsed ? c.invalid : c.inputHint}</p>
      </aside>

      <section className="min-w-0 space-y-3">
        <div className="panel p-2">
          {rows.map((row) => (
            <div key={row.label}>
              {row.group && <h3 className="px-3 pt-3 pb-1 text-[12px] font-medium text-muted">{row.group}</h3>}
              {/* Narrow screens: label on its own line, value wraps instead of being cut off */}
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 rounded-[14px] px-3 py-1.5 hover:bg-panel-2/60 sm:grid-cols-[10rem_minmax(0,1fr)_auto]">
                <span className="col-span-2 text-[12px] text-muted sm:col-span-1 sm:text-[13px]">{row.label}</span>
                <code className="font-mono text-[13px] break-all sm:truncate" title={row.value}>
                  {row.value}
                </code>
                <CopyButton text={row.value} className="h-8 px-3 text-xs" />
              </div>
            </div>
          ))}
        </div>

        <div className="panel p-4">
          <h3 className="mb-3 text-[13px] font-medium text-muted">{c.contrast}</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[
              [c.onWhite, white, '#fff'],
              [c.onBlack, black, '#000'],
            ].map(([label, bg, bgCss]) => {
              const ratio = contrast(rgba, bg as Rgba);
              return (
                <div key={label as string} className="flex items-center gap-3">
                  <span
                    className="grid h-12 w-16 shrink-0 place-items-center rounded-xl text-[15px] font-semibold shadow-[inset_0_0_0_1px_var(--line)]"
                    style={{ background: bgCss as string, color: solid }}
                  >
                    Aa
                  </span>
                  <div className="text-[13px]">
                    <p>
                      {label as string} <span className="font-mono font-semibold">{ratio.toFixed(2)}:1</span>
                    </p>
                    <p className="mt-0.5 flex gap-2 text-muted">
                      <Grade ok={ratio >= 4.5} label="AA" />
                      <Grade ok={ratio >= 7} label="AAA" />
                      <Grade ok={ratio >= 3} label={c.large} />
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-muted">{c.contrastNote}</p>
        </div>
      </section>
    </div>
  );
}

function Grade({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-0.5 ${ok ? 'text-ok' : 'text-danger'}`}>
      {ok ? <Check size={12} strokeWidth={3} /> : <X size={12} strokeWidth={3} />}
      {label}
    </span>
  );
}

function Bar(props: {
  drag: ReturnType<typeof useDrag>;
  label: string;
  value: number;
  valueText: string;
  onKey: (e: React.KeyboardEvent) => void;
  background: string;
  thumb: string;
  checker?: boolean;
}) {
  const { drag, label, value, valueText, onKey, background, thumb, checker } = props;
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-[13px] font-medium text-muted">
        <span>{label}</span>
        <span className="font-mono">{valueText}</span>
      </div>
      <div
        {...drag}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(value * 100)}
        aria-valuetext={valueText}
        onKeyDown={onKey}
        className="relative h-4 cursor-pointer touch-none rounded-full outline-none focus-visible:ring-4 focus-visible:ring-accent/30"
        style={checker ? CHECKER : undefined}
      >
        <span className="absolute inset-0 rounded-full shadow-[inset_0_0_0_1px_rgb(0_0_0/0.08)]" style={{ background }} />
        <span
          className="pointer-events-none absolute top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white shadow-[0_0_0_1px_rgb(0_0_0/0.3),0_2px_6px_rgb(0_0_0/0.3)]"
          style={{ left: pct(value), background: thumb }}
        />
      </div>
    </div>
  );
}

export default withI18n(ColorConverter);
