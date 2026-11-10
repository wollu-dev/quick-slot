import { Monitor, Moon, Sun, type LucideIcon } from 'lucide-react';
import { useTheme, type ThemePref } from '../lib/theme';

const OPTIONS: [ThemePref, string, LucideIcon][] = [
  ['light', '라이트', Sun],
  ['system', '시스템 설정', Monitor],
  ['dark', '다크', Moon],
];

/** 헤더의 테마 선택 (라이트 / 시스템 / 다크) */
export default function ThemeToggle() {
  const [pref, setPref] = useTheme();
  return (
    <div className="segmented shrink-0" role="radiogroup" aria-label="테마">
      {OPTIONS.map(([value, label, Icon]) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={pref === value}
          aria-label={label}
          title={label}
          onClick={() => setPref(value)}
          className="grid w-8 place-items-center !px-0"
        >
          <Icon size={15} strokeWidth={2.2} />
        </button>
      ))}
    </div>
  );
}
