/**
 * 퀵슬롯 독의 위치·크기 설정.
 * 실제 적용은 <html data-dock="left|bottom|right" data-dock-size="s|m|l"> → global.css 의 .dock 규칙.
 * 첫 화면 적용은 Layout.astro 의 <head> 인라인 스크립트가 한다 (같은 키·기본값 사용).
 */
import { useEffect, useState } from 'react';

export type DockPosition = 'left' | 'bottom' | 'right';
export type DockSize = 's' | 'm' | 'l';
export interface DockSettings {
  position: DockPosition;
  size: DockSize;
}

export const DOCK_KEY = 'quickslot:dock';
export const DOCK_DEFAULTS: DockSettings = { position: 'bottom', size: 'm' };

export function readDock(): DockSettings {
  try {
    const raw = JSON.parse(localStorage.getItem(DOCK_KEY) ?? '{}');
    return {
      position: ['left', 'bottom', 'right'].includes(raw.position) ? raw.position : DOCK_DEFAULTS.position,
      size: ['s', 'm', 'l'].includes(raw.size) ? raw.size : DOCK_DEFAULTS.size,
    };
  } catch {
    return DOCK_DEFAULTS;
  }
}

export function applyDock(d: DockSettings) {
  document.documentElement.dataset.dock = d.position;
  document.documentElement.dataset.dockSize = d.size;
}

export function useDockSettings() {
  const [dock, setDock] = useState<DockSettings>(DOCK_DEFAULTS);
  useEffect(() => setDock(readDock()), []);

  const update = (patch: Partial<DockSettings>) => {
    const next = { ...dock, ...patch };
    setDock(next);
    applyDock(next);
    try {
      localStorage.setItem(DOCK_KEY, JSON.stringify(next));
    } catch {
      /* 저장소 사용 불가: 이번 페이지에서만 반영 */
    }
  };

  return [dock, update] as const;
}
