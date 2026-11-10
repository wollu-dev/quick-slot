import { useEffect, useRef, useState } from 'react';
import { Star, X } from 'lucide-react';
import { useLang, useT, withI18n } from '../i18n';
import Rich from '../i18n/Rich';
import { useSlots, toggleSlot } from '../lib/slots';
import { getTool, toolText, toolUrl } from '../tools/registry';
import AppIcon from './ui/AppIcon';

const HINT_DISMISSED_KEY = 'quickslot:dock-hint-dismissed';

/** 말풍선을 닫았는지 (브라우저에 기억). 저장된 값을 읽기 전에는 보이지 않게 해서 깜빡임을 막는다. */
function useHintVisible() {
  const [state, setState] = useState<'loading' | 'show' | 'hidden'>('loading');
  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(HINT_DISMISSED_KEY) === '1';
    } catch {
      /* 저장소 사용 불가 */
    }
    setState(dismissed ? 'hidden' : 'show');
  }, []);
  const dismiss = () => {
    setState('hidden');
    try {
      localStorage.setItem(HINT_DISMISSED_KEY, '1');
    } catch {
      /* 저장소 사용 불가: 이번 페이지에서만 닫힘 */
    }
  };
  return [state === 'show', dismiss] as const;
}

/**
 * 독의 호버 효과를 켜도 되는지.
 * 툴로 갔다가 뒤로가기로 돌아오면 브라우저가 마우스가 아직 클릭했던 독 아이콘 위에 있다고 판단해서
 * (실제 마우스는 다른 곳에 있어도) :hover 가 남는다. 그래서 페이지가 보인 뒤 마우스가 실제로 움직였을 때만 호버를 켠다.
 * 같은 이유로 클릭 때문에 독에 남은 포커스도 풀어준다.
 */
function useHoverReady(navRef: React.RefObject<HTMLElement | null>) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const onMove = () => {
      setReady(true);
      window.removeEventListener('pointermove', onMove);
    };
    const arm = () => {
      setReady(false);
      const el = document.activeElement;
      if (el instanceof HTMLElement && navRef.current?.contains(el)) el.blur();
      window.addEventListener('pointermove', onMove);
    };
    arm();
    window.addEventListener('pageshow', arm);
    return () => {
      window.removeEventListener('pageshow', arm);
      window.removeEventListener('pointermove', onMove);
    };
  }, [navRef]);
  return ready;
}

/**
 * 퀵슬롯 독 (macOS Dock 처럼). 모든 페이지에 표시된다.
 * 위치(왼쪽/아래/오른쪽)·크기·확대 효과는 global.css 의 .dock 규칙이 맡는다.
 * currentSlug 가 슬롯에 있으면 아이콘 옆에 점을 찍어 "지금 열려 있음"을 표시한다.
 */
function Dock({ currentSlug }: { currentSlug?: string }) {
  const t = useT();
  const lang = useLang();
  const slots = useSlots();
  const empty = slots.every((s) => !s);
  const [hintVisible, dismissHint] = useHintVisible();
  const navRef = useRef<HTMLElement>(null);
  const hoverReady = useHoverReady(navRef);

  return (
    <nav ref={navRef} aria-label={t.dock.label} className="dock" data-hover-ready={hoverReady ? '' : undefined}>
      <div className="dock-bar glass shadow-[0_10px_40px_-10px_rgb(0_0_0/0.3)]">
        {empty && hintVisible && <EmptyHint onClose={dismissHint} />}

        {slots.map((slug, i) => {
          const tool = slug ? getTool(slug) : undefined;
          const active = !!tool && tool.slug === currentSlug;
          const name = tool ? toolText(lang, tool.slug).name : '';
          return (
            <div key={i} className="dock-slot">
              {tool ? (
                // 아이콘과 ✕ 를 한 덩어리(.dock-lift)로 확대해서 ✕ 가 확대된 아이콘을 따라가고,
                // ✕ 위에 마우스를 올려도 같은 칸(.dock-slot) 위라서 확대가 풀리지 않는다.
                <div className="dock-lift">
                  <a
                    href={toolUrl(tool.slug, lang)}
                    title={`${name} · Alt+${i + 1}`}
                    aria-label={`${name} (Alt+${i + 1})`}
                    aria-current={active ? 'page' : undefined}
                    className="block rounded-[13px] outline-none focus-visible:ring-4 focus-visible:ring-accent/30"
                  >
                    <AppIcon tool={tool} size="dock" />
                  </a>
                  <button
                    type="button"
                    aria-label={t.dock.remove(name)}
                    onClick={() => toggleSlot(tool.slug)}
                    className="dock-remove absolute -top-1.5 -left-1.5 grid size-[18px] place-items-center rounded-full bg-[var(--raised)] text-muted shadow-md hover:text-danger"
                  >
                    <X size={11} strokeWidth={3} />
                  </button>
                </div>
              ) : (
                <div
                  title={t.dock.empty}
                  className="dock-tile grid place-items-center border border-dashed border-muted/30 text-[11px] font-medium text-muted/50 sm:text-[12px]"
                >
                  {i + 1}
                </div>
              )}
              {active && <span className="dock-dot" aria-hidden />}
            </div>
          );
        })}
      </div>
    </nav>
  );
}

/** 슬롯이 모두 비어 있을 때 독 옆에 뜨는 말풍선 */
function EmptyHint({ onClose }: { onClose: () => void }) {
  const t = useT();
  return (
    <div className="dock-hint" role="note">
      <div className="glass-menu relative flex items-center gap-2 rounded-2xl py-2 pr-2 pl-4 text-[13px] leading-snug shadow-[0_10px_30px_-10px_rgb(0_0_0/0.3)]">
        <Star size={15} strokeWidth={2.2} className="shrink-0 text-accent" fill="currentColor" />
        <span>
          <Rich text={t.dock.hint} />
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label={t.dock.closeHint}
          title={t.common.close}
          className="grid size-6 shrink-0 place-items-center rounded-full text-muted transition hover:bg-panel-2 hover:text-fg"
        >
          <X size={14} strokeWidth={2.4} />
        </button>
        <span className="dock-hint-tail glass-menu" aria-hidden />
      </div>
    </div>
  );
}

export default withI18n(Dock);
