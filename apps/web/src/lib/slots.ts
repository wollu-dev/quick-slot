/**
 * 퀵슬롯: 즐겨찾는 툴을 1~9번 칸에 고정한다. Alt+숫자로 바로 이동.
 * 브라우저(localStorage)에만 저장되며, 저장소를 쓸 수 없는 환경에서도 동작은 한다.
 */
import { useEffect, useState } from 'react';

export const SLOT_COUNT = 9;
const KEY = 'quickslot:slots';
const EVENT = 'quickslot:slots-changed';

export function readSlots(): (string | null)[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    if (Array.isArray(raw)) {
      return Array.from({ length: SLOT_COUNT }, (_, i) => (typeof raw[i] === 'string' ? raw[i] : null));
    }
  } catch {
    /* 저장소 사용 불가 */
  }
  return Array(SLOT_COUNT).fill(null);
}

function writeSlots(slots: (string | null)[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(slots));
  } catch {
    /* 저장소 사용 불가: 이번 페이지에서만 반영 */
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: slots }));
}

/** 슬롯에 있으면 빼고, 없으면 첫 빈칸에 넣는다. 빈칸이 없으면 false */
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
