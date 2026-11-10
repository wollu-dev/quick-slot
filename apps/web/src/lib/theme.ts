/**
 * 테마(라이트/다크/시스템). 실제 적용은 <html data-theme="light|dark">.
 * 첫 화면 깜빡임을 막는 초기 적용은 Layout.astro 의 <head> 인라인 스크립트가 한다 (같은 키·규칙 사용).
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
    /* 저장소 사용 불가 */
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

  // 시스템 설정을 따를 때는 OS 테마가 바뀌면 바로 반영
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
      /* 저장소 사용 불가: 이번 페이지에서만 반영 */
    }
  };

  return [pref, set] as const;
}
