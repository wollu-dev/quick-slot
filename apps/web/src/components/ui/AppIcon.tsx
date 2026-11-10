import type { CSSProperties } from 'react';
import { getCategory, type Tool } from '../../tools/registry';

const SIZES = {
  /** 독: 크기는 global.css 의 --dock-icon (설정·화면 폭에 따라 바뀜) */
  dock: { box: 'dock-tile [&>svg]:size-[52%]', icon: 24 },
  sm: { box: 'size-8 rounded-[9px]', icon: 17 },
  md: { box: 'size-11 rounded-[12px]', icon: 22 },
  lg: { box: 'size-14 rounded-[15px]', icon: 28 },
  xl: { box: 'size-[72px] rounded-[19px]', icon: 36 },
};

/** iOS 앱 아이콘 같은 둥근 타일. 색은 툴의 카테고리 색을 따른다. */
export default function AppIcon({ tool, size = 'md', className = '' }: { tool: Tool; size?: keyof typeof SIZES; className?: string }) {
  const s = SIZES[size];
  const Icon = tool.icon;
  return (
    <span className={`app-icon ${s.box} ${className}`} style={{ '--tile': getCategory(tool.category).color } as CSSProperties} aria-hidden>
      <Icon size={s.icon} strokeWidth={2} />
    </span>
  );
}
