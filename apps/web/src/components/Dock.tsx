import { X } from 'lucide-react';
import { useSlots, toggleSlot } from '../lib/slots';
import { getTool, toolUrl } from '../tools/registry';
import AppIcon from './ui/AppIcon';

/**
 * 화면 하단에 고정된 퀵슬롯 독 (macOS Dock 처럼). 모든 페이지에 표시된다.
 * currentSlug 가 슬롯에 있으면 아이콘 아래에 점을 찍어 "지금 열려 있음"을 표시한다.
 */
export default function Dock({ currentSlug }: { currentSlug?: string }) {
  const slots = useSlots();

  return (
    <nav
      aria-label="퀵슬롯"
      className="pointer-events-none fixed inset-x-0 z-40 flex justify-center px-2"
      style={{ bottom: 'max(12px, env(safe-area-inset-bottom))' }}
    >
      <div className="glass pointer-events-auto flex items-end gap-1 rounded-[20px] p-1.5 shadow-[0_10px_40px_-10px_rgb(0_0_0/0.3)] sm:gap-2 sm:rounded-[24px] sm:p-2">
        {slots.map((slug, i) => {
          const tool = slug ? getTool(slug) : undefined;
          const active = !!tool && tool.slug === currentSlug;
          return (
            <div key={i} className="group relative flex flex-col items-center">
              {tool ? (
                <>
                  <a
                    href={toolUrl(tool.slug)}
                    title={`${tool.name} · Alt+${i + 1}`}
                    aria-label={`${tool.name} (Alt+${i + 1})`}
                    aria-current={active ? 'page' : undefined}
                    className="block origin-bottom rounded-[13px] transition duration-200 ease-out outline-none hover:-translate-y-1 hover:scale-115 focus-visible:-translate-y-1 focus-visible:ring-4 focus-visible:ring-accent/30"
                  >
                    <AppIcon tool={tool} size="dock" />
                  </a>
                  <button
                    type="button"
                    aria-label={`${tool.name} 슬롯에서 빼기`}
                    onClick={() => toggleSlot(tool.slug)}
                    className="absolute -top-2 -left-2 hidden size-5 place-items-center rounded-full bg-[var(--raised)] text-muted shadow-md transition group-hover:grid hover:text-danger focus:grid"
                  >
                    <X size={12} strokeWidth={3} />
                  </button>
                </>
              ) : (
                <div
                  title="비어 있음 — 툴 페이지에서 '퀵슬롯에 추가'"
                  className="grid size-[34px] place-items-center rounded-[9px] border border-dashed border-muted/30 text-[11px] font-medium text-muted/50 sm:size-12 sm:rounded-[13px] sm:text-[12px]"
                >
                  {i + 1}
                </div>
              )}
              {/* 지금 보고 있는 툴 표시 점 */}
              <span className={`mt-1 size-1 rounded-full ${active ? 'bg-fg/70' : 'bg-transparent'}`} aria-hidden />
            </div>
          );
        })}
      </div>
    </nav>
  );
}
