import { useState } from 'react';
import { Star } from 'lucide-react';
import { useSlots, toggleSlot } from '../lib/slots';

/** 툴 페이지의 "퀵슬롯에 추가" 버튼 */
export default function SlotButton({ slug }: { slug: string }) {
  const slots = useSlots();
  const [full, setFull] = useState(false);
  const idx = slots.indexOf(slug);
  const inSlot = idx >= 0;

  return (
    <button
      type="button"
      className={`btn ${inSlot ? 'btn-tinted' : ''}`}
      onClick={() => setFull(!toggleSlot(slug))}
      title={inSlot ? `Alt+${idx + 1} 로 바로 열 수 있어요. 누르면 빠집니다.` : '퀵슬롯에 추가하면 Alt+숫자로 바로 열 수 있어요'}
    >
      <Star size={15} strokeWidth={2.2} fill={inSlot ? 'currentColor' : 'none'} />
      {inSlot ? `슬롯 ${idx + 1}` : full ? '슬롯이 가득 찼어요' : '퀵슬롯에 추가'}
    </button>
  );
}
