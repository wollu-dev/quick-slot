/**
 * Internationalization (Korean · English · Japanese).
 *
 * - URLs: Korean is `/…`, English `/en/…`, Japanese `/ja/…` (static pages are generated per language)
 * - Use the dictionary via `getDict(lang)` in .astro files and `useT()` in React islands.
 *   Wrap an island's top-level component in `withI18n` and pass `lang` from Astro.
 * - The language the user picks in settings is saved to localStorage, and the <head> script in Layout
 *   redirects to the chosen language's URL when a page is opened in another language.
 */
import { createContext, useContext, type ComponentType } from 'react';
import ko, { type Dict } from './ko';
import en from './en';
import ja from './ja';

export type { Dict };

export const LOCALES = ['ko', 'en', 'ja'] as const;
export type Lang = (typeof LOCALES)[number];
export const DEFAULT_LANG: Lang = 'ko';

/** Names shown in the language picker (always written in that language itself) */
export const LANG_NAMES: Record<Lang, string> = { ko: '한국어', en: 'English', ja: '日本語' };
/** BCP 47 tags for formatting dates and numbers */
export const LANG_TAGS: Record<Lang, string> = { ko: 'ko-KR', en: 'en-US', ja: 'ja-JP' };
export const LANG_KEY = 'quickslot:lang';

const DICTS: Record<Lang, Dict> = { ko, en, ja };

export const isLang = (v: unknown): v is Lang => typeof v === 'string' && (LOCALES as readonly string[]).includes(v);
export const getDict = (lang: Lang): Dict => DICTS[lang];

/** '/tools/x' → the URL for the language ('/en/tools/x'). Home is '/en/' */
export function localizePath(lang: Lang, path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return lang === DEFAULT_LANG ? p : `/${lang}${p}`;
}

/**
 * The first supported language in the browser preferences (navigator.languages), or null if none.
 * e.g. ['en-GB', 'ko'] → 'en', ['fr', 'de'] → null
 */
export function detectBrowserLang(languages: readonly string[]): Lang | null {
  for (const l of languages) {
    // 'en-US' → 'en'. Some environments append a quality value like 'en;q=0.8', so strip that too
    const base = l.toLowerCase().split(';')[0].split('-')[0].trim();
    if (isLang(base)) return base;
  }
  return null;
}

/** Language the user picked explicitly (settings or the suggestion banner), or null */
export function readSavedLang(): Lang | null {
  try {
    const v = localStorage.getItem(LANG_KEY);
    return isLang(v) ? v : null;
  } catch {
    return null;
  }
}

export function saveLang(lang: Lang) {
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    /* Storage unavailable: applies to this page only */
  }
}

/** Navigate to this same page in another language */
export function goToLang(lang: Lang) {
  const { path } = splitLocale(location.pathname);
  location.href = localizePath(lang, path) + location.search + location.hash;
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

/** Wraps an Astro island's top-level component and provides lang via context */
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
