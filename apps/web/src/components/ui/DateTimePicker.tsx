import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { LANG_TAGS, useLang, useT } from '../../i18n';
import { usePopover } from './usePopover';

interface Props {
  /**
   * Local date and time as `YYYY-MM-DDTHH:mm:ss` (the same format as <input type="datetime-local">),
   * or `YYYY-MM-DD` when `time` is false
   */
  value: string;
  onChange: (v: string) => void;
  id?: string;
  /** Accessible name when there is no visible label */
  label?: string;
  /** Show and edit the time too (default). false = date only */
  time?: boolean;
}

const pad = (n: number) => String(n).padStart(2, '0');
export const toDateTimeValue = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
export const toDateValue = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** Always read as local time (new Date('2026-11-11') alone would be UTC midnight) */
const parse = (v: string) => {
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!m) return new Date();
  const [, y, mo, d, h = '0', mi = '0', sec = '0'] = m;
  return new Date(+y, +mo - 1, +d, +h, +mi, +sec);
};
/** The same day of the month n months later, clamped to that month's last day (Jan 31 + 1 month = Feb 28) */
const addMonths = (d: Date, n: number) => {
  const last = new Date(d.getFullYear(), d.getMonth() + n + 1, 0).getDate();
  return new Date(d.getFullYear(), d.getMonth() + n, Math.min(d.getDate(), last));
};
const MIN_YEAR = 1000;
const MAX_YEAR = 9999;

const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/**
 * Date and time picker that matches Select. Built by hand because the browser's native
 * date/time popup can't be styled and ignores the site language.
 * Weekday and month names come from Intl in the current language.
 */
export default function DateTimePicker({ value, onChange, id, label, time = true }: Props) {
  const t = useT();
  const lang = useLang();
  const tag = LANG_TAGS[lang];
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const date = parse(value);
  // The month shown in the calendar (can differ from the selected date while browsing)
  const [view, setView] = useState(() => new Date(date.getFullYear(), date.getMonth(), 1));
  // Days of a month, the 12 months of a year, or 12 years: the label above the calendar switches between them
  const [mode, setMode] = useState<'days' | 'months' | 'years'>('days');

  const close = useCallback((focusTrigger = true) => {
    setOpen(false);
    if (focusTrigger) triggerRef.current?.focus();
  }, []);
  const dismiss = useCallback(() => close(false), [close]);
  const pos = usePopover(open, triggerRef, popRef, dismiss);

  const openPicker = () => {
    setView(new Date(date.getFullYear(), date.getMonth(), 1));
    setMode('days');
    setOpen(true);
  };

  // Focus the selected day (or month, or year) when the picker opens or switches view
  useEffect(() => {
    if (pos) popRef.current?.querySelector<HTMLElement>('[data-grid] [tabindex="0"]')?.focus({ preventScroll: true });
  }, [pos, mode]);

  useEffect(() => {
    if (!open) return;
    // Escape steps back to the days first, then closes
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (mode !== 'days') setMode('days');
      else close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close, mode]);

  const set = (d: Date) => onChange(time ? toDateTimeValue(d) : toDateValue(d));
  const setDay = (day: Date) => {
    const d = new Date(date);
    d.setFullYear(day.getFullYear(), day.getMonth(), day.getDate());
    set(d);
    if (day.getMonth() !== view.getMonth() || day.getFullYear() !== view.getFullYear()) setView(new Date(day.getFullYear(), day.getMonth(), 1));
  };
  const setTime = (part: 'h' | 'm' | 's', n: number) => {
    const d = new Date(date);
    if (part === 'h') d.setHours(n);
    if (part === 'm') d.setMinutes(n);
    if (part === 's') d.setSeconds(n);
    set(d);
  };

  // Always 6 weeks, starting on Sunday, so the popover height never changes
  const days = useMemo(() => {
    const start = new Date(view.getFullYear(), view.getMonth(), 1 - view.getDay());
    return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }, [view]);
  const weekdays = useMemo(() => {
    const f = new Intl.DateTimeFormat(tag, { weekday: 'narrow' });
    return Array.from({ length: 7 }, (_, i) => f.format(new Date(2023, 0, 1 + i))); // 2023-01-01 is a Sunday
  }, [tag]);
  const monthLabel = new Intl.DateTimeFormat(tag, { year: 'numeric', month: 'long' }).format(view);
  const yearFmt = useMemo(() => new Intl.DateTimeFormat(tag, { year: 'numeric' }), [tag]);
  const monthNames = useMemo(() => {
    const fm = new Intl.DateTimeFormat(tag, { month: 'short' });
    return Array.from({ length: 12 }, (_, i) => fm.format(new Date(2023, i, 1)));
  }, [tag]);
  const yearOf = (y: number) => yearFmt.format(new Date(y, 0, 1));
  // 12 years per page, aligned so the same years always share a page
  const pageStart = Math.floor(view.getFullYear() / 12) * 12;
  const headerLabel =
    mode === 'days'
      ? monthLabel
      : mode === 'months'
        ? yearOf(view.getFullYear())
        : `${yearOf(Math.max(MIN_YEAR, pageStart))} – ${yearOf(Math.min(MAX_YEAR, pageStart + 11))}`;
  const shown = time
    ? date.toLocaleString(tag, { dateStyle: 'medium', timeStyle: 'medium' })
    : date.toLocaleDateString(tag, { year: 'numeric', month: 'short', day: 'numeric', weekday: 'short' });
  const today = new Date();

  const onDayKey = (e: React.KeyboardEvent, day: Date) => {
    const move = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    // Page Up / Down: a month back or forward; with Shift: a year
    const months = { PageUp: -1, PageDown: 1 }[e.key];
    if (move === undefined && months === undefined) return;
    e.preventDefault();
    const next = move !== undefined ? new Date(day.getFullYear(), day.getMonth(), day.getDate() + move) : addMonths(day, months! * (e.shiftKey ? 12 : 1));
    if (next.getFullYear() < MIN_YEAR || next.getFullYear() > MAX_YEAR) return;
    setDay(next);
    requestAnimationFrame(() => popRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus());
  };

  /** The arrows move by a month, a year or 12 years depending on the view */
  const shift = (dir: 1 | -1) => {
    const months = mode === 'days' ? 1 : mode === 'months' ? 12 : 144;
    const next = new Date(view.getFullYear(), view.getMonth() + dir * months, 1);
    const y = next.getFullYear();
    if (y < MIN_YEAR || y > MAX_YEAR) {
      // A partial page of years at either end is still worth showing
      if (mode !== 'years' || (dir < 0 ? pageStart <= MIN_YEAR : pageStart + 11 >= MAX_YEAR)) return;
      next.setFullYear(Math.min(MAX_YEAR, Math.max(MIN_YEAR, y)));
    }
    setView(next);
  };
  const arrows = {
    days: [t.picker.prevMonth, t.picker.nextMonth],
    months: [t.picker.prevYear, t.picker.nextYear],
    years: [t.picker.prevYears, t.picker.nextYears],
  }[mode];
  const pickMonth = (m: number) => {
    setView(new Date(view.getFullYear(), m, 1));
    setMode('days');
  };
  const pickYear = (y: number) => {
    setView(new Date(y, view.getMonth(), 1));
    setMode('months');
  };
  /** Arrow keys in the month and year grids (3 columns) */
  const onCellKey = (e: React.KeyboardEvent) => {
    const move = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -3, ArrowDown: 3 }[e.key];
    if (move === undefined) return;
    e.preventDefault();
    const cells = [...(popRef.current?.querySelectorAll<HTMLElement>('[data-grid] button:not(:disabled)') ?? [])];
    const i = cells.indexOf(e.currentTarget as HTMLElement);
    cells[Math.min(cells.length - 1, Math.max(0, i + move))]?.focus();
  };

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={label}
        onClick={() => (open ? close() : openPicker())}
        className={`input flex cursor-default items-center justify-between gap-2 text-left tabular-nums ${open ? 'border-accent/60 ring-4 ring-accent/15' : ''}`}
      >
        <span className="truncate">{shown}</span>
        <CalendarDays size={15} strokeWidth={2.2} className="shrink-0 text-muted" />
      </button>

      {open &&
        createPortal(
          <div
            ref={popRef}
            role="dialog"
            aria-label={label}
            style={{
              top: pos?.top ?? -9999,
              left: pos?.left ?? -9999,
              transformOrigin: pos?.origin === 'bottom' ? 'bottom center' : 'top center',
            }}
            className={`glass-menu fixed z-[60] w-[292px] rounded-[18px] p-3 shadow-[0_18px_50px_-12px_rgb(0_0_0/0.35)] outline-none ${pos ? 'menu-pop' : 'invisible'}`}
          >
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                data-view-toggle
                title={mode === 'days' ? t.picker.chooseMonth : mode === 'months' ? t.picker.chooseYear : undefined}
                aria-label={mode === 'years' ? headerLabel : `${headerLabel}, ${mode === 'days' ? t.picker.chooseMonth : t.picker.chooseYear}`}
                aria-live="polite"
                disabled={mode === 'years'}
                onClick={() => setMode(mode === 'days' ? 'months' : 'years')}
                className="flex h-8 items-center gap-1 rounded-full px-2 text-[15px] font-semibold tabular-nums transition outline-none enabled:hover:bg-panel-2 focus-visible:ring-4 focus-visible:ring-accent/30 disabled:cursor-default"
              >
                {headerLabel}
                {mode !== 'years' && (
                  <ChevronDown size={15} strokeWidth={2.6} className={`text-accent transition-transform ${mode === 'months' ? 'rotate-180' : ''}`} />
                )}
              </button>
              <div className="flex">
                <IconButton label={arrows[0]} onClick={() => shift(-1)}>
                  <ChevronLeft size={18} strokeWidth={2.4} />
                </IconButton>
                <IconButton label={arrows[1]} onClick={() => shift(1)}>
                  <ChevronRight size={18} strokeWidth={2.4} />
                </IconButton>
              </div>
            </div>

            {mode !== 'days' ? (
              // Same height as the days, so the popover doesn't jump when switching
              <div data-grid className="grid h-[258px] grid-cols-3 content-center gap-x-1 gap-y-2" role="grid">
                {mode === 'months'
                  ? monthNames.map((name, m) => (
                      <Cell
                        key={m}
                        selected={date.getFullYear() === view.getFullYear() && date.getMonth() === m}
                        current={today.getFullYear() === view.getFullYear() && today.getMonth() === m}
                        focus={m === view.getMonth()}
                        onClick={() => pickMonth(m)}
                        onKeyDown={onCellKey}
                      >
                        {name}
                      </Cell>
                    ))
                  : Array.from({ length: 12 }, (_, i) => pageStart + i).map((y) => (
                      <Cell
                        key={y}
                        selected={y === date.getFullYear()}
                        current={y === today.getFullYear()}
                        focus={y === view.getFullYear()}
                        disabled={y < MIN_YEAR || y > MAX_YEAR}
                        onClick={() => pickYear(y)}
                        onKeyDown={onCellKey}
                      >
                        {yearOf(y)}
                      </Cell>
                    ))}
              </div>
            ) : (
              <div data-grid className="h-[258px]">
                <div className="grid grid-cols-7 text-center text-[11px] font-medium text-muted" aria-hidden>
                  {weekdays.map((w, i) => (
                    <span key={i} className="py-1">
                      {w}
                    </span>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-y-0.5" role="grid">
                  {days.map((day) => {
                    const selected = sameDay(day, date);
                    const outside = day.getMonth() !== view.getMonth();
                    const isToday = sameDay(day, today);
                    return (
                      <button
                        key={day.getTime()}
                        type="button"
                        role="gridcell"
                        aria-selected={selected}
                        aria-label={day.toLocaleDateString(tag, { dateStyle: 'full' })}
                        tabIndex={selected ? 0 : -1}
                        onClick={() => setDay(day)}
                        onKeyDown={(e) => onDayKey(e, day)}
                        className={`mx-auto grid size-9 place-items-center rounded-full text-[14px] tabular-nums transition outline-none focus-visible:ring-4 focus-visible:ring-accent/30 ${
                          selected
                            ? 'bg-accent font-semibold text-accent-fg'
                            : `hover:bg-panel-2 ${isToday ? 'font-semibold text-accent' : outside ? 'text-muted/50' : 'text-fg'}`
                        }`}
                      >
                        {day.getDate()}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {time && (
            <div className="mt-3 flex items-center gap-2 border-t border-line pt-3">
              <span className="mr-auto pl-1 text-[13px] font-medium text-muted">{t.picker.time}</span>
              <TimePart label={t.picker.hour} value={date.getHours()} max={23} onChange={(n) => setTime('h', n)} />
              <span className="text-muted">:</span>
              <TimePart label={t.picker.minute} value={date.getMinutes()} max={59} onChange={(n) => setTime('m', n)} />
              <span className="text-muted">:</span>
              <TimePart label={t.picker.second} value={date.getSeconds()} max={59} onChange={(n) => setTime('s', n)} />
            </div>
            )}

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                className="btn"
                onClick={() => {
                  const now = new Date();
                  set(now);
                  setView(new Date(now.getFullYear(), now.getMonth(), 1));
                }}
              >
                {time ? t.picker.now : t.picker.today}
              </button>
              <button type="button" className="btn btn-primary" onClick={() => close()}>
                {t.common.done}
              </button>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

/** A month or a year in the month and year views */
function Cell({
  selected,
  current,
  focus,
  disabled,
  onClick,
  onKeyDown,
  children,
}: {
  selected: boolean;
  current: boolean;
  focus: boolean;
  disabled?: boolean;
  onClick: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="gridcell"
      aria-selected={selected}
      tabIndex={focus ? 0 : -1}
      disabled={disabled}
      onClick={onClick}
      onKeyDown={onKeyDown}
      className={`h-11 rounded-full text-[14px] tabular-nums transition outline-none focus-visible:ring-4 focus-visible:ring-accent/30 disabled:opacity-30 ${
        selected ? 'bg-accent font-semibold text-accent-fg' : `hover:bg-panel-2 ${current ? 'font-semibold text-accent' : 'text-fg'}`
      }`}
    >
      {children}
    </button>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="grid size-8 place-items-center rounded-full text-accent transition outline-none hover:bg-panel-2 focus-visible:ring-4 focus-visible:ring-accent/30"
    >
      {children}
    </button>
  );
}

/** Two-digit hour / minute / second field. Typing replaces it; ↑ ↓ step with wrap-around. */
function TimePart({ label, value, max, onChange }: { label: string; value: number; max: number; onChange: (n: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = (text: string) => {
    const n = Number(text);
    if (text !== '' && Number.isInteger(n)) onChange(Math.min(max, Math.max(0, n)));
  };
  return (
    <input
      type="text"
      inputMode="numeric"
      aria-label={label}
      maxLength={2}
      value={draft ?? pad(value)}
      onFocus={(e) => e.target.select()}
      onChange={(e) => {
        const text = e.target.value.replace(/\D/g, '');
        setDraft(text);
        if (text.length === 2) commit(text);
      }}
      onBlur={() => {
        if (draft !== null) commit(draft);
        setDraft(null);
      }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          setDraft(null);
          onChange((value + (e.key === 'ArrowUp' ? 1 : -1) + max + 1) % (max + 1));
        } else if (e.key === 'Enter') {
          (e.target as HTMLInputElement).blur();
        }
      }}
      className="input w-11 px-0 text-center tabular-nums"
    />
  );
}
