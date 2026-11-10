import { Search } from 'lucide-react';
import { OPEN_SEARCH_EVENT } from './CommandPalette';

/** 홈 화면 가운데의 큰 검색창. 누르면 상단의 검색 창(스포트라이트)이 열린다. */
export default function HeroSearch() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_SEARCH_EVENT))}
      className="glass group flex h-14 w-full max-w-xl items-center gap-3 rounded-full px-5 text-left transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_14px_40px_-12px_rgb(0_0_0/0.22)] focus-visible:ring-4 focus-visible:ring-accent/25 focus-visible:outline-none"
    >
      <Search size={20} strokeWidth={2.2} className="shrink-0 text-muted" />
      <span className="flex-1 text-[17px] text-muted">툴 검색</span>
      <span className="kbd hidden sm:inline-flex">Ctrl K</span>
    </button>
  );
}
