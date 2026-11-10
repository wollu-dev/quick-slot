import { useEffect, useRef, useState } from 'react';
import { Star, X } from 'lucide-react';
import { useSlots, toggleSlot } from '../lib/slots';
import { getTool, toolUrl } from '../tools/registry';
import AppIcon from './ui/AppIcon';

const HINT_DISMISSED_KEY = 'quickslot:dock-hint-dismissed';

const HOVER_LIFT = 'group-hover:-translate-y-1 group-hover:scale-115';
const HOVER_SHOW = 'group-hover:opacity-100';

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
 * 화면 하단에 고정된 퀵슬롯 독 (macOS Dock 처럼). 모든 페이지에 표시된다.
 * currentSlug 가 슬롯에 있으면 아이콘 아래에 점을 찍어 "지금 열려 있음"을 표시한다.
 */
export default function Dock({ currentSlug }: { currentSlug?: string }) {
  const slots = useSlots();
  const empty = slots.every((s) => !s);
  const [hintVisible, dismissHint] = useHintVisible();
  const navRef = useRef<HTMLElement>(null);
  const hoverReady = useHoverReady(navRef);

  return (
    <nav
      ref={navRef}
      aria-label="퀵슬롯"
      className="pointer-events-none fixed inset-x-0 z-40 flex justify-center px-2"
      style={{ bottom: 'max(12px, env(safe-area-inset-bottom))' }}
    >
      <div className="glass pointer-events-auto relative flex items-end gap-1 rounded-[20px] p-1.5 shadow-[0_10px_40px_-10px_rgb(0_0_0/0.3)] sm:gap-2 sm:rounded-[24px] sm:p-2">
        {empty && hintVisible && <EmptyHint onClose={dismissHint} />}

        {slots.map((slug, i) => {
          const tool = slug ? getTool(slug) : undefined;
          const active = !!tool && tool.slug === currentSlug;
          return (
            <div key={i} className="group relative flex">
              {tool ? (
                // 아이콘과 ✕ 를 한 덩어리로 확대해서 ✕ 가 확대된 아이콘을 따라가고,
                // ✕ 위에 마우스를 올려도 덩어리(group) 위에 있으므로 확대가 풀리지 않는다.
                // 확대 조건: 마우스 호버(페이지에 온 뒤 마우스가 실제로 움직인 다음부터) 또는 키보드 포커스(:focus-visible).
                <div className={`relative origin-bottom transition duration-200 ease-out group-has-[:focus-visible]:-translate-y-1 group-has-[:focus-visible]:scale-115 ${hoverReady ? HOVER_LIFT : ''}`}>
                  <a
                    href={toolUrl(tool.slug)}
                    title={`${tool.name} · Alt+${i + 1}`}
                    aria-label={`${tool.name} (Alt+${i + 1})`}
                    aria-current={active ? 'page' : undefined}
                    className="block rounded-[13px] outline-none focus-visible:ring-4 focus-visible:ring-accent/30"
                  >
                    <AppIcon tool={tool} size="dock" />
                  </a>
                  <button
                    type="button"
                    aria-label={`${tool.name} 슬롯에서 빼기`}
                    onClick={() => toggleSlot(tool.slug)}
                    className={`absolute -top-1.5 -left-1.5 grid size-[18px] place-items-center rounded-full bg-[var(--raised)] text-muted opacity-0 shadow-md transition group-has-[:focus-visible]:opacity-100 hover:text-danger ${hoverReady ? HOVER_SHOW : ''}`}
                  >
                    <X size={11} strokeWidth={3} />
                  </button>
                </div>
              ) : (
                <div
                  title="비어 있음"
                  className="grid size-[34px] place-items-center rounded-[9px] border border-dashed border-muted/30 text-[11px] font-medium text-muted/50 sm:size-12 sm:rounded-[13px] sm:text-[12px]"
                >
                  {i + 1}
                </div>
              )}
              {/* 지금 보고 있는 툴 표시 점 — 독 안쪽 여백 위에 겹쳐 그려서 점이 없을 때 빈 공간이 생기지 않게 */}
              {active && (
                <span className="absolute -bottom-[5px] left-1/2 size-1 -translate-x-1/2 rounded-full bg-fg/70 sm:-bottom-1.5" aria-hidden />
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}

/** 슬롯이 모두 비어 있을 때 독 위에 뜨는 말풍선 */
function EmptyHint({ onClose }: { onClose: () => void }) {
  return (
    <div className="dock-hint absolute bottom-full left-1/2 mb-3 w-max max-w-[calc(100vw-32px)] -translate-x-1/2" role="note">
      <div className="glass-menu relative flex items-center gap-2 rounded-2xl py-2 pr-2 pl-4 text-[13px] leading-snug shadow-[0_10px_30px_-10px_rgb(0_0_0/0.3)]">
        <Star size={15} strokeWidth={2.2} className="shrink-0 text-accent" fill="currentColor" />
        <span>
          툴 페이지에서 <b className="font-semibold">퀵슬롯에 추가</b>를 누르면 여기에 담겨요
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="안내 닫기"
          title="닫기"
          className="grid size-6 shrink-0 place-items-center rounded-full text-muted transition hover:bg-panel-2 hover:text-fg"
        >
          <X size={14} strokeWidth={2.4} />
        </button>
        {/* 꼬리 */}
        <span
          className="glass-menu absolute -bottom-[6px] left-1/2 size-3 -translate-x-1/2 rotate-45 rounded-[2px] border-t-0 border-l-0"
          aria-hidden
        />
      </div>
    </div>
  );
}
