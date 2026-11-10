import { useEffect, useRef, useState } from 'react';
import { Star, X } from 'lucide-react';
import { useLang, useT, withI18n } from '../i18n';
import Rich from '../i18n/Rich';
import { useSlots, toggleSlot } from '../lib/slots';
import { getTool, toolText, toolUrl } from '../tools/registry';
import AppIcon from './ui/AppIcon';

const HINT_DISMISSED_KEY = 'quickslot:dock-hint-dismissed';

/** Whether the hint bubble was dismissed (remembered in the browser). Hidden until the stored value is read, to avoid a flash. */
function useHintVisible() {
  const [state, setState] = useState<'loading' | 'show' | 'hidden'>('loading');
  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(HINT_DISMISSED_KEY) === '1';
    } catch {
      /* Storage unavailable */
    }
    setState(dismissed ? 'hidden' : 'show');
  }, []);
  const dismiss = () => {
    setState('hidden');
    try {
      localStorage.setItem(HINT_DISMISSED_KEY, '1');
    } catch {
      /* Storage unavailable: stays dismissed for this page only */
    }
  };
  return [state === 'show', dismiss] as const;
}

/**
 * Whether the dock hover effect may be enabled.
 * After opening a tool and coming back with the Back button, the browser assumes the pointer is still over the dock icon that was clicked,
 * so :hover sticks (even though the real pointer is elsewhere). So hover is only enabled once the pointer actually moves after the page is shown.
 * For the same reason, focus left on the dock by the click is also cleared.
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
 * Quick Slot dock (like the macOS Dock). Shown on every page.
 * Position (left/bottom/right), size and magnification are handled by the .dock rules in global.css.
 * If currentSlug is in a slot, a dot next to its icon marks it as "currently open".
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
                // The icon and ✕ are magnified together as one unit (.dock-lift) so the ✕ follows the enlarged icon,
                // and hovering the ✕ keeps the magnification since it is still inside the same cell (.dock-slot).
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

/** Hint bubble shown next to the dock when all slots are empty */
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
