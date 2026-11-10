/**
 * Quick Slots: pin favorite tools to slots 1–9. Alt+number jumps straight to one.
 * Stored only in the browser (localStorage); still works where storage is unavailable.
 */
import { useEffect, useState } from 'react';

export const SLOT_COUNT = 9;
const KEY = 'quickslot:slots';
const EVENT = 'quickslot:slots-changed';

/** Tools that were renamed or merged: old slug → current slug, so saved slots keep working */
const RENAMED: Record<string, string> = {
  'extension-changer': 'file-converter',
  'heic-to-jpg': 'file-converter',
  'image-convert': 'image-compress',
};

export function readSlots(): (string | null)[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    if (Array.isArray(raw)) {
      const slots = Array.from({ length: SLOT_COUNT }, (_, i) => (typeof raw[i] === 'string' ? (RENAMED[raw[i]] ?? raw[i]) : null));
      // Two old tools may now point to the same one; keep only the first
      return slots.map((s, i) => (s && slots.indexOf(s) !== i ? null : s));
    }
  } catch {
    /* Storage unavailable */
  }
  return Array(SLOT_COUNT).fill(null);
}

function writeSlots(slots: (string | null)[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(slots));
  } catch {
    /* Storage unavailable: applies to this page only */
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: slots }));
}

/** Removes the tool if it is in a slot, otherwise puts it in the first empty slot. Returns false if there is none */
export function toggleSlot(slug: string): boolean {
  const slots = readSlots();
  const idx = slots.indexOf(slug);
  if (idx >= 0) {
    slots[idx] = null;
  } else {
    const empty = slots.indexOf(null);
    if (empty < 0) return false;
    slots[empty] = slug;
  }
  writeSlots(slots);
  return true;
}

export function useSlots() {
  const [slots, setSlots] = useState<(string | null)[]>(() => Array(SLOT_COUNT).fill(null));
  useEffect(() => {
    setSlots(readSlots());
    const onChange = (e: Event) => setSlots((e as CustomEvent).detail);
    const onStorage = (e: StorageEvent) => e.key === KEY && setSlots(readSlots());
    window.addEventListener(EVENT, onChange);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener('storage', onStorage);
    };
  }, []);
  return slots;
}
