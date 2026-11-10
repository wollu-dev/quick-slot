/**
 * Theme (light/dark/system). Applied via <html data-theme="light|dark">.
 * The initial application, which prevents a flash on first paint, is done by the inline <head> script in Layout.astro (same keys and rules).
 */
import { useEffect, useState } from 'react';

export type ThemePref = 'light' | 'dark' | 'system';

export const THEME_KEY = 'quickslot:theme';
export const THEME_COLORS = { light: '#fafafc', dark: '#1c1c1f' } as const;

const media = () => window.matchMedia('(prefers-color-scheme: dark)');

export function readThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    /* Storage unavailable */
  }
  return 'system';
}

export function applyTheme(pref: ThemePref) {
  const resolved = pref === 'system' ? (media().matches ? 'dark' : 'light') : pref;
  document.documentElement.dataset.theme = resolved;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[resolved]);
}

export function useTheme() {
  const [pref, setPref] = useState<ThemePref>('system');

  useEffect(() => setPref(readThemePref()), []);

  // When following the system setting, react immediately to OS theme changes
  useEffect(() => {
    if (pref !== 'system') return;
    const mq = media();
    const onChange = () => applyTheme('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [pref]);

  const set = (next: ThemePref) => {
    setPref(next);
    applyTheme(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* Storage unavailable: applies to this page only */
    }
  };

  return [pref, set] as const;
}
