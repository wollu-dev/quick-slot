import { useEffect, useState } from 'react';
import { Languages, X } from 'lucide-react';
import { detectBrowserLang, getDict, goToLang, readSavedLang, saveLang, type Lang } from '../i18n';

/**
 * Language suggestion banner.
 *
 * Auto-redirecting by browser language would always send search engine crawlers (mostly English or no language info) to another language,
 * so the Korean and Japanese pages would never get indexed. So we never redirect, only "suggest" (the approach Google recommends).
 *
 * Shown when: the user has never picked a language explicitly (in settings or this banner), and the browser language is supported
 * but differs from the current page language. The text is shown in the "detected language", not the page language (so the user can read it).
 * - View: save that language and navigate → from then on the <head> script switches to it automatically
 * - Close: save the current language → don't ask again
 *
 * Rendered with client:only (the browser language is unknown on the server).
 */
export default function LanguageSuggest({ lang }: { lang: Lang }) {
  const [suggested, setSuggested] = useState<Lang | null>(null);

  useEffect(() => {
    if (readSavedLang()) return;
    const detected = detectBrowserLang(navigator.languages?.length ? navigator.languages : [navigator.language]);
    if (detected && detected !== lang) setSuggested(detected);
  }, [lang]);

  if (!suggested) return null;
  const s = getDict(suggested).langSuggest;

  return (
    <div lang={suggested} role="region" aria-label={s.message} className="glass fade-in mb-6 flex items-center gap-3 rounded-2xl py-2 pr-2 pl-4">
      <Languages size={18} strokeWidth={2.1} className="shrink-0 text-accent" aria-hidden />
      <p className="min-w-0 flex-1 text-[14px]">{s.message}</p>
      <button
        type="button"
        className="btn btn-primary h-8 shrink-0 px-3.5 text-[13px]"
        onClick={() => {
          saveLang(suggested);
          goToLang(suggested);
        }}
      >
        {s.switchTo}
      </button>
      <button
        type="button"
        aria-label={s.close}
        title={s.close}
        onClick={() => {
          saveLang(lang);
          setSuggested(null);
        }}
        className="grid size-8 shrink-0 place-items-center rounded-full text-muted transition hover:bg-panel-2 hover:text-fg"
      >
        <X size={16} strokeWidth={2.4} />
      </button>
    </div>
  );
}
