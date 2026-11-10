import { useEffect, useLayoutEffect, useState, type RefObject } from 'react';

const GAP = 6;

export interface PopoverPos {
  top: number;
  left: number;
  width: number;
  origin: 'top' | 'bottom';
}

/**
 * Shared behavior of the hand-built popovers (Select, DateTimePicker), portaled to body:
 * placed under the trigger (or above it when there isn't room below), kept inside the viewport,
 * and dismissed on an outside click, a page scroll or a window resize.
 * Returns null until the position is measured; render the popover invisible until then.
 */
export function usePopover(
  open: boolean,
  triggerRef: RefObject<HTMLElement | null>,
  popRef: RefObject<HTMLElement | null>,
  onDismiss: () => void,
): PopoverPos | null {
  const [pos, setPos] = useState<PopoverPos | null>(null);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !popRef.current) {
      setPos(null);
      return;
    }
    const r = triggerRef.current.getBoundingClientRect();
    const h = popRef.current.offsetHeight;
    const w = Math.max(r.width, popRef.current.offsetWidth);
    const below = window.innerHeight - r.bottom - GAP;
    const placeAbove = below < h && r.top > below;
    setPos({
      top: placeAbove ? Math.max(8, r.top - GAP - h) : r.bottom + GAP,
      left: Math.max(8, Math.min(r.left, window.innerWidth - w - 8)),
      width: r.width,
      origin: placeAbove ? 'bottom' : 'top',
    });
  }, [open, triggerRef, popRef]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!popRef.current?.contains(t) && !triggerRef.current?.contains(t)) onDismiss();
    };
    const onScroll = (e: Event) => {
      if (!popRef.current?.contains(e.target as Node)) onDismiss();
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onDismiss);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onDismiss);
    };
  }, [open, triggerRef, popRef, onDismiss]);

  return pos;
}
