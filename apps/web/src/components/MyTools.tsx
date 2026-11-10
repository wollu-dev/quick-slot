import { useEffect, useState } from 'react';
import { ExternalLink, Pencil, Plus, Star } from 'lucide-react';
import { useT, withI18n } from '../i18n';
import { hostOf, slotIdOf, useCustomTools, type CustomTool } from '../lib/customTools';
import { toggleSlot, useSlots } from '../lib/slots';
import { useLaunchCustomTool } from './ExternalToolWarning';
import CustomToolDialog from './CustomToolDialog';
import { LetterIcon } from './ui/AppIcon';

/**
 * "My tools" section on the home page: the user's custom (external) tools and the tile to add one.
 * The surrounding <section data-category="custom"> lives in HomePage.astro so the category filter can hide it.
 */
function MyTools({ builtInCount }: { builtInCount: number }) {
  const t = useT();
  const c = t.custom;
  const list = useCustomTools();
  const slots = useSlots();
  const [launch, warning] = useLaunchCustomTool();
  const [editing, setEditing] = useState<CustomTool | 'new' | null>(null);

  // The filter chips are static HTML; keep their counts in step with the stored list
  useEffect(() => {
    document.querySelectorAll('[data-count="custom"]').forEach((el) => (el.textContent = String(list.length)));
    document.querySelectorAll('[data-count="all"]').forEach((el) => (el.textContent = String(builtInCount + list.length)));
  }, [list.length, builtInCount]);

  return (
    <>
      <div className="mb-4 flex items-baseline gap-3 px-1">
        <h2 className="text-[22px] font-bold tracking-tight">{c.title}</h2>
        <span className="text-[14px] text-muted">{c.description}</span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((tool) => {
          const slotIdx = slots.indexOf(slotIdOf(tool));
          return (
            <div key={tool.id} className="panel group flex items-center gap-1 p-1.5 pr-2 transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_14px_40px_-12px_rgb(0_0_0/0.22)]">
              <button type="button" onClick={() => launch(tool)} className="flex min-w-0 flex-1 items-center gap-3.5 rounded-[18px] p-2 text-left outline-none focus-visible:ring-4 focus-visible:ring-accent/30">
                <LetterIcon name={tool.name} color={tool.color} size="md" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-[15px] font-semibold">{tool.name}</span>
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-panel-2 px-2 py-0.5 text-[11px] font-medium text-muted">
                      <ExternalLink size={11} strokeWidth={2.4} />
                      {c.external}
                    </span>
                  </span>
                  <span className="mt-0.5 block truncate text-[13px] text-muted">{hostOf(tool.url)}</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => toggleSlot(slotIdOf(tool))}
                title={slotIdx >= 0 ? t.slot.inSlotTitle(slotIdx + 1) : t.slot.addTitle}
                aria-label={slotIdx >= 0 ? t.dock.remove(tool.name) : `${t.slot.add}: ${tool.name}`}
                aria-pressed={slotIdx >= 0}
                className={`grid size-9 shrink-0 place-items-center rounded-full transition hover:bg-panel-2 ${slotIdx >= 0 ? 'text-accent' : 'text-muted'}`}
              >
                <Star size={16} strokeWidth={2.2} fill={slotIdx >= 0 ? 'currentColor' : 'none'} />
              </button>
              <button
                type="button"
                onClick={() => setEditing(tool)}
                title={c.edit(tool.name)}
                aria-label={c.edit(tool.name)}
                className="grid size-9 shrink-0 place-items-center rounded-full text-muted transition hover:bg-panel-2 hover:text-fg"
              >
                <Pencil size={15} strokeWidth={2.2} />
              </button>
            </div>
          );
        })}

        <button
          type="button"
          onClick={() => setEditing('new')}
          className="flex items-center gap-3.5 rounded-[22px] border border-dashed border-muted/35 p-3.5 pr-4 text-left transition hover:border-accent/60 hover:bg-panel-2/50"
        >
          <span className="grid size-11 shrink-0 place-items-center rounded-[12px] bg-panel-2 text-muted">
            <Plus size={22} strokeWidth={2.2} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-semibold">{c.add}</span>
            <span className="mt-0.5 block truncate text-[13px] text-muted">{c.addHint}</span>
          </span>
        </button>
      </div>

      {editing && <CustomToolDialog tool={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      {warning}
    </>
  );
}

export default withI18n(MyTools);
