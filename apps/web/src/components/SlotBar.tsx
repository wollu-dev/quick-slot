import { useSlots, toggleSlot } from '../lib/slots';
import { getTool, getCategory, toolUrl } from '../tools/registry';

/** 홈 화면 상단의 퀵슬롯 9칸 */
export default function SlotBar() {
  const slots = useSlots();
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-9">
      {slots.map((slug, i) => {
        const tool = slug ? getTool(slug) : undefined;
        return (
          <div key={i} className="group relative aspect-square">
            <span className="pointer-events-none absolute left-1.5 top-1 z-10 font-mono text-[10px] text-muted">{i + 1}</span>
            {tool ? (
              <>
                <a
                  href={toolUrl(tool.slug)}
                  className="panel flex h-full flex-col items-center justify-center gap-1 p-2 text-center transition hover:border-accent"
                >
                  <span className="text-2xl" aria-hidden>{getCategory(tool.category).icon}</span>
                  <span className="line-clamp-2 text-[11px] leading-tight">{tool.name}</span>
                </a>
                <button
                  type="button"
                  title="슬롯에서 빼기"
                  aria-label={`${tool.name} 슬롯에서 빼기`}
                  onClick={() => toggleSlot(tool.slug)}
                  className="absolute right-1 top-0.5 text-xs text-muted opacity-0 transition hover:text-danger focus:opacity-100 group-hover:opacity-100"
                >
                  ✕
                </button>
              </>
            ) : (
              <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-line text-lg text-muted/30">
                +
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
