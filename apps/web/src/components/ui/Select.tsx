import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronsUpDown } from 'lucide-react';

interface Props<T extends string> {
  value: T;
  onChange: (v: T) => void;
  options: readonly (readonly [T, string])[];
  id?: string;
  /** Accessible name for screen readers when there is no visible label */
  label?: string;
  className?: string;
}

const GAP = 6;

/**
 * Dropdown. Built by hand because the browser's native <select> list can't be styled.
 * The menu is portaled to body so it isn't trapped by a panel's backdrop-filter or overflow.
 */
export default function Select<T extends string>({ value, onChange, options, id, label, className = '' }: Props<T>) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<{ top: number; left: number; width: number; origin: 'top' | 'bottom' } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const selectedIndex = Math.max(0, options.findIndex(([v]) => v === value));
  const current = options[selectedIndex]?.[1] ?? '';

  const close = (focusTrigger = true) => {
    setOpen(false);
    setPos(null);
    if (focusTrigger) triggerRef.current?.focus();
  };

  const choose = (i: number) => {
    const opt = options[i];
    if (opt) onChange(opt[0]);
    close();
  };

  const openMenu = () => {
    setActive(selectedIndex);
    setOpen(true);
  };

  // On open, position relative to the trigger. Flip above it if there isn't enough room below.
  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !menuRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const h = menuRef.current.offsetHeight;
    const below = window.innerHeight - r.bottom - GAP;
    const placeAbove = below < h && r.top > below;
    setPos({
      top: placeAbove ? r.top - GAP - h : r.bottom + GAP,
      left: Math.min(r.left, window.innerWidth - Math.max(r.width, menuRef.current.offsetWidth) - 8),
      width: r.width,
      origin: placeAbove ? 'bottom' : 'top',
    });
    menuRef.current.focus({ preventScroll: true });
  }, [open]);

  // Close on outside click, scroll or window resize
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!menuRef.current?.contains(t) && !triggerRef.current?.contains(t)) close(false);
    };
    const onScroll = (e: Event) => {
      if (!menuRef.current?.contains(e.target as Node)) close(false);
    };
    const onResize = () => close(false);
    document.addEventListener('mousedown', onDown);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  const onTriggerKey = (e: React.KeyboardEvent) => {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
      e.preventDefault();
      openMenu();
    }
  };

  const onMenuKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => (a + 1) % options.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => (a - 1 + options.length) % options.length);
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActive(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setActive(options.length - 1);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      choose(active);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'Tab') {
      close(false);
    }
  };

  const listId = `${id ?? 'select'}-listbox`;

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={label}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={onTriggerKey}
        className={`input flex cursor-default items-center justify-between gap-2 text-left ${open ? 'border-accent/60 ring-4 ring-accent/15' : ''} ${className}`}
      >
        <span className="truncate">{current}</span>
        <ChevronsUpDown size={15} strokeWidth={2.2} className="shrink-0 text-muted" />
      </button>

      {open &&
        createPortal(
          <ul
            ref={menuRef}
            id={listId}
            role="listbox"
            tabIndex={-1}
            aria-activedescendant={`${listId}-${active}`}
            onKeyDown={onMenuKey}
            style={{
              top: pos?.top ?? -9999,
              left: pos?.left ?? -9999,
              minWidth: pos?.width,
              transformOrigin: pos?.origin === 'bottom' ? 'bottom center' : 'top center',
            }}
            className={`glass-menu fixed z-[60] max-h-[min(320px,60vh)] overflow-y-auto rounded-[14px] p-1.5 shadow-[0_18px_50px_-12px_rgb(0_0_0/0.35)] outline-none ${pos ? 'menu-pop' : 'invisible'}`}
          >
            {options.map(([v, text], i) => {
              const selected = i === selectedIndex;
              const isActive = i === active;
              return (
                <li
                  key={v}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={selected}
                  onMouseMove={() => setActive(i)}
                  onClick={() => choose(i)}
                  className={`flex cursor-default items-center gap-2 rounded-[8px] py-1.5 pr-4 pl-2 text-[14px] whitespace-nowrap select-none ${
                    isActive ? 'bg-accent text-accent-fg' : 'text-fg'
                  }`}
                >
                  <Check size={14} strokeWidth={2.8} className={`shrink-0 ${selected ? '' : 'invisible'}`} />
                  {text}
                </li>
              );
            })}
          </ul>,
          document.body,
        )}
    </>
  );
}
