import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronsUpDown } from 'lucide-react';
import { usePopover } from './usePopover';

interface Props<T extends string> {
  value: T;
  onChange: (v: T) => void;
  options: readonly (readonly [T, string])[];
  id?: string;
  /** Accessible name for screen readers when there is no visible label */
  label?: string;
  className?: string;
}

/**
 * Dropdown. Built by hand because the browser's native <select> list can't be styled.
 * The menu is portaled to body so it isn't trapped by a panel's backdrop-filter or overflow.
 */
export default function Select<T extends string>({ value, onChange, options, id, label, className = '' }: Props<T>) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const selectedIndex = Math.max(0, options.findIndex(([v]) => v === value));
  const current = options[selectedIndex]?.[1] ?? '';

  const close = useCallback((focusTrigger = true) => {
    setOpen(false);
    if (focusTrigger) triggerRef.current?.focus();
  }, []);
  const dismiss = useCallback(() => close(false), [close]);
  const pos = usePopover(open, triggerRef, menuRef, dismiss);

  const choose = (i: number) => {
    const opt = options[i];
    if (opt) onChange(opt[0]);
    close();
  };

  const openMenu = () => {
    setActive(selectedIndex);
    setOpen(true);
  };

  useEffect(() => {
    if (pos) menuRef.current?.focus({ preventScroll: true });
  }, [pos]);

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
