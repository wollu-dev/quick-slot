import { useEffect, useState } from 'react';
import { Languages, X } from 'lucide-react';
import { detectBrowserLang, getDict, goToLang, readSavedLang, saveLang, type Lang } from '../i18n';

/**
 * 언어 제안 배너.
 *
 * 브라우저 언어로 자동 이동시키면 검색엔진 로봇(대부분 영어·언어 정보 없음)이 항상 다른 언어로 넘어가
 * 한국어·일본어 페이지가 수집되지 않는다. 그래서 이동은 하지 않고 "제안"만 한다 (Google 권장 방식).
 *
 * 보여주는 조건: 사용자가 언어를 직접 고른 적이 없고(설정·이 배너), 브라우저 언어가 지원 언어이면서
 * 지금 페이지 언어와 다를 때. 문구는 페이지 언어가 아니라 "감지된 언어"로 보여준다 (그래야 읽을 수 있음).
 * - 보기: 그 언어를 저장하고 이동 → 다음부터는 <head> 스크립트가 알아서 그 언어로
 * - 닫기: 지금 언어를 저장 → 다시 묻지 않음
 *
 * client:only 로 띄운다 (브라우저 언어는 서버에서 알 수 없음).
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
