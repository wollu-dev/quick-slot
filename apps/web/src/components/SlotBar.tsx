import { X } from 'lucide-react';
import { useSlots, toggleSlot } from '../lib/slots';
import { getTool, toolUrl } from '../tools/registry';
import AppIcon from './ui/AppIcon';

/** 홈 화면의 퀵슬롯 9칸 — 독(Dock) 형태 */
export default function SlotBar() {
  const slots = useSlots();
  const empty = slots.every((s) => !s);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="glass flex max-w-full flex-wrap justify-center gap-x-1 gap-y-2 rounded-[30px] p-2.5 sm:flex-nowrap sm:gap-2.5 sm:p-3">
        {slots.map((slug, i) => {
          const tool = slug ? getTool(slug) : undefined;
          return (
            <div key={i} className="group relative flex w-[60px] shrink-0 flex-col items-center sm:w-[76px]">
              {tool ? (
                <>
                  <a
                    href={toolUrl(tool.slug)}
                    title={`${tool.name} (Alt+${i + 1})`}
                    className="flex flex-col items-center gap-1.5 rounded-2xl p-1 transition duration-300 hover:-translate-y-1 focus-visible:-translate-y-1"
                  >
                    <AppIcon tool={tool} size="lg" className="transition group-hover:scale-105" />
                    <span className="line-clamp-1 w-full text-center text-[11px] leading-tight font-medium">{tool.name}</span>
                  </a>
                  <button
                    type="button"
                    aria-label={`${tool.name} 슬롯에서 빼기`}
                    onClick={() => toggleSlot(tool.slug)}
                    className="absolute -top-1 -left-0.5 grid size-5 place-items-center rounded-full bg-[var(--raised)] text-muted opacity-0 shadow-md transition group-hover:opacity-100 hover:text-danger focus:opacity-100"
                  >
                    <X size={12} strokeWidth={3} />
                  </button>
                </>
              ) : (
                <div className="flex flex-col items-center gap-1.5 p-1">
                  <div className="grid size-14 place-items-center rounded-[15px] border border-dashed border-muted/30 text-[12px] font-medium text-muted/50">
                    {i + 1}
                  </div>
                  <span className="text-[11px] leading-tight text-transparent select-none">.</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {empty && <p className="text-[13px] text-muted">툴 페이지에서 <span className="font-medium text-fg">퀵슬롯에 추가</span>를 누르면 여기에 나타나요</p>}
    </div>
  );
}
