/**
 * 다국어(한국어·English·日本語).
 *
 * - 주소: 한국어는 `/…`, 영어는 `/en/…`, 일본어는 `/ja/…` (언어마다 정적 페이지 생성)
 * - .astro 에서는 `getDict(lang)`, React 섬(island)에서는 `useT()` 로 사전을 쓴다.
 *   섬의 최상위 컴포넌트는 `withI18n` 으로 감싸고 Astro 에서 `lang` 을 넘겨준다.
 * - 사용자가 설정에서 고른 언어는 localStorage 에 저장되고, Layout 의 <head> 스크립트가
 *   다른 언어 주소로 들어왔을 때 고른 언어 주소로 옮겨준다.
 */
import { createContext, useContext, type ComponentType } from 'react';
import ko, { type Dict } from './ko';
import en from './en';
import ja from './ja';

export type { Dict };

export const LOCALES = ['ko', 'en', 'ja'] as const;
export type Lang = (typeof LOCALES)[number];
export const DEFAULT_LANG: Lang = 'ko';

/** 언어 선택 메뉴에 보일 이름 (항상 그 언어 자신의 표기) */
export const LANG_NAMES: Record<Lang, string> = { ko: '한국어', en: 'English', ja: '日本語' };
/** 날짜·숫자 표시용 BCP 47 태그 */
export const LANG_TAGS: Record<Lang, string> = { ko: 'ko-KR', en: 'en-US', ja: 'ja-JP' };
export const LANG_KEY = 'quickslot:lang';

const DICTS: Record<Lang, Dict> = { ko, en, ja };

export const isLang = (v: unknown): v is Lang => typeof v === 'string' && (LOCALES as readonly string[]).includes(v);
export const getDict = (lang: Lang): Dict => DICTS[lang];

/** '/tools/x' → 언어에 맞는 주소 ('/en/tools/x'). 홈은 '/en/' */
export function localizePath(lang: Lang, path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return lang === DEFAULT_LANG ? p : `/${lang}${p}`;
}

/** '/en/tools/x' → { lang: 'en', path: '/tools/x' } */
export function splitLocale(pathname: string): { lang: Lang; path: string } {
  const m = pathname.match(/^\/(en|ja)(?=\/|$)(.*)$/);
  if (m) return { lang: m[1] as Lang, path: m[2] || '/' };
  return { lang: DEFAULT_LANG, path: pathname || '/' };
}

// ───────────── React ─────────────

const LangContext = createContext<Lang>(DEFAULT_LANG);

export const useLang = () => useContext(LangContext);
export const useT = () => getDict(useLang());

/** Astro 섬의 최상위 컴포넌트를 감싸서 lang 을 컨텍스트로 내려준다 */
export function withI18n<P extends object>(Component: ComponentType<P>) {
  function WithI18n(props: P & { lang: Lang }) {
    return (
      <LangContext.Provider value={props.lang}>
        <Component {...props} />
      </LangContext.Provider>
    );
  }
  WithI18n.displayName = `WithI18n(${Component.displayName ?? Component.name})`;
  return WithI18n;
}
