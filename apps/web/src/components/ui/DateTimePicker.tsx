import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
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

  const close = useCallback((focusTrigger = true) => {
    setOpen(false);
    if (focusTrigger) triggerRef.current?.focus();
  }, []);
  const dismiss = useCallback(() => close(false), [close]);
  const pos = usePopover(open, triggerRef, popRef, dismiss);

  const openPicker = () => {
    setView(new Date(date.getFullYear(), date.getMonth(), 1));
    setOpen(true);
  };

  // Focus the selected day when the picker opens
  useEffect(() => {
    if (pos) popRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus({ preventScroll: true });
  }, [pos]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  const set = (d: Date) => onChange(time ? toDateTimeValue(d) : toDateValue(d));
  const setDay = (day: Date) => {
    const d = new Date(date);
    d.setFullYear(day.getFullYear(), day.getMonth(), day.getDate());
    set(d);
    if (day.getMonth() !== view.getMonth()) setView(new Date(day.getFullYear(), day.getMonth(), 1));
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
  const shown = time
    ? date.toLocaleString(tag, { dateStyle: 'medium', timeStyle: 'medium' })
    : date.toLocaleDateString(tag, { year: 'numeric', month: 'short', day: 'numeric', weekday: 'short' });
  const today = new Date();

  const onDayKey = (e: React.KeyboardEvent, day: Date) => {
    const move = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (move === undefined) return;
    e.preventDefault();
    const next = new Date(day.getFullYear(), day.getMonth(), day.getDate() + move);
    setDay(next);
    requestAnimationFrame(() => popRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus());
  };

  const shiftMonth = (n: number) => setView(new Date(view.getFullYear(), view.getMonth() + n, 1));

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
            <div className="mb-2 flex items-center justify-between pl-2">
              <span className="text-[15px] font-semibold" aria-live="polite">
                {monthLabel}
              </span>
              <div className="flex">
                <IconButton label={t.picker.prevMonth} onClick={() => shiftMonth(-1)}>
                  <ChevronLeft size={18} strokeWidth={2.4} />
                </IconButton>
                <IconButton label={t.picker.nextMonth} onClick={() => shiftMonth(1)}>
                  <ChevronRight size={18} strokeWidth={2.4} />
                </IconButton>
              </div>
            </div>

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
