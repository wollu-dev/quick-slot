import type { CSSProperties } from 'react';
import { CUSTOM_COLORS, getCategory, type Tool } from '../../tools/registry';

const SIZES = {
  /** Dock: size comes from --dock-icon in global.css (varies with settings and screen width) */
  dock: { box: 'dock-tile [&>svg]:size-[52%]', icon: 24 },
  sm: { box: 'size-8 rounded-[9px]', icon: 17 },
  md: { box: 'size-11 rounded-[12px]', icon: 22 },
  lg: { box: 'size-14 rounded-[15px]', icon: 28 },
  xl: { box: 'size-[72px] rounded-[19px]', icon: 36 },
};

/** Rounded tile like an iOS app icon. Its color follows the tool's category color. */
export default function AppIcon({ tool, size = 'md', className = '' }: { tool: Tool; size?: keyof typeof SIZES; className?: string }) {
  const s = SIZES[size];
  const Icon = tool.icon;
  return (
    <span className={`app-icon ${s.box} ${className}`} style={{ '--tile': getCategory(tool.category).color } as CSSProperties} aria-hidden>
      <Icon size={s.icon} strokeWidth={2} />
    </span>
  );
}

/**
 * Icon for a custom (external) tool: the first letter of its name on a colored tile.
 * Nothing is loaded from the external site (no favicon), so adding a tool never contacts it.
 */
export function LetterIcon({ name, color, size = 'md', className = '' }: { name: string; color: number; size?: keyof typeof SIZES; className?: string }) {
  const s = SIZES[size];
  const letter = Array.from(name.trim())[0]?.toUpperCase() ?? '?';
  return (
    <span
      className={`app-icon ${s.box} font-semibold ${className}`}
      style={{ '--tile': CUSTOM_COLORS[color] ?? CUSTOM_COLORS[0], fontSize: size === 'dock' ? 'calc(var(--dock-icon) * 0.44)' : s.icon * 0.95 } as CSSProperties}
      aria-hidden
    >
      {letter}
    </span>
  );
}
