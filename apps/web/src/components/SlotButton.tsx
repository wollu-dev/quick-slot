import { useState } from 'react';
import { Star } from 'lucide-react';
import { useT, withI18n } from '../i18n';
import { useSlots, toggleSlot } from '../lib/slots';

/** "Add to Quick Slots" button on tool pages */
function SlotButton({ slug }: { slug: string }) {
  const t = useT();
  const slots = useSlots();
  const [full, setFull] = useState(false);
  const idx = slots.indexOf(slug);
  const inSlot = idx >= 0;

  return (
    <button
      type="button"
      className={`btn ${inSlot ? 'btn-tinted' : ''}`}
      onClick={() => setFull(!toggleSlot(slug))}
      title={inSlot ? t.slot.inSlotTitle(idx + 1) : t.slot.addTitle}
    >
      <Star size={15} strokeWidth={2.2} fill={inSlot ? 'currentColor' : 'none'} />
      {inSlot ? t.slot.inSlot(idx + 1) : full ? t.slot.full : t.slot.add}
    </button>
  );
}

export default withI18n(SlotButton);
