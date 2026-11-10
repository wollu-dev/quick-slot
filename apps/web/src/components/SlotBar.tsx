import { X } from 'lucide-react';
import { useSlots, toggleSlot } from '../lib/slots';
import { getTool, toolUrl } from '../tools/registry';
import AppIcon from './ui/AppIcon';

/** 홈 화면의 퀵슬롯 9칸 — 아이콘만 있는 독(Dock) */
export default function SlotBar() {
  const slots = useSlots();
  const empty = slots.every((s) => !s);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="glass flex max-w-full flex-wrap justify-center gap-2.5 rounded-[28px] p-3 sm:flex-nowrap sm:gap-3">
        {slots.map((slug, i) => {
          const tool = slug ? getTool(slug) : undefined;
          return (
            <div key={i} className="group relative size-14 shrink-0">
              {tool ? (
                <>
                  <a
                    href={toolUrl(tool.slug)}
                    title={`${tool.name} · Alt+${i + 1}`}
                    aria-label={`${tool.name} (Alt+${i + 1})`}
                    className="block rounded-[15px] transition duration-300 ease-out outline-none hover:-translate-y-1.5 hover:scale-110 focus-visible:-translate-y-1.5 focus-visible:ring-4 focus-visible:ring-accent/30"
                  >
                    <AppIcon tool={tool} size="lg" />
                  </a>
                  <button
                    type="button"
                    aria-label={`${tool.name} 슬롯에서 빼기`}
                    onClick={() => toggleSlot(tool.slug)}
                    className="absolute -top-1.5 -left-1.5 grid size-5 place-items-center rounded-full bg-[var(--raised)] text-muted opacity-0 shadow-md transition group-hover:opacity-100 hover:text-danger focus:opacity-100"
                  >
                    <X size={12} strokeWidth={3} />
                  </button>
                </>
              ) : (
                <div className="grid size-14 place-items-center rounded-[15px] border border-dashed border-muted/30 text-[12px] font-medium text-muted/50">
                  {i + 1}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {empty && (
        <p className="text-[13px] text-muted">
          툴 페이지의 <span className="font-medium text-fg">퀵슬롯에 추가</span>로 자주 쓰는 툴을 모아두세요
        </p>
      )}
    </div>
  );
}
