import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Check, Settings } from 'lucide-react';
import { LANG_NAMES, LOCALES, goToLang, saveLang, useLang, useT, withI18n, type Lang } from '../i18n';
import { useDockSettings, type DockPosition, type DockSize } from '../lib/dock';
import { useTheme, type ThemePref } from '../lib/theme';
import Segmented from './ui/Segmented';
import Select from './ui/Select';

/**
 * Settings (gear) button on the right of the header, and the settings sheet.
 * Inset grouped list like iOS Settings: appearance · Quick Slot position/size · language.
 * Centered sheet on desktop, bottom sheet that slides up on mobile.
 */
function SettingsSheet() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const close = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t.header.settings}
        title={t.header.settings}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="grid size-9 shrink-0 place-items-center rounded-full bg-panel-2 text-muted transition hover:bg-[color-mix(in_srgb,var(--panel-2)_100%,var(--fg)_6%)] hover:text-fg"
      >
        <Settings size={17} strokeWidth={2.1} />
      </button>
      {open && createPortal(<Sheet onClose={close} />, document.body)}
    </>
  );
}

function Sheet({ onClose }: { onClose: () => void }) {
  const t = useT();
  const s = t.settings;
  const lang = useLang();
  const [theme, setTheme] = useTheme();
  const [dock, setDock] = useDockSettings();
  const sheetRef = useRef<HTMLDivElement>(null);

  // While open: close on Esc, lock background page scroll, move focus into the sheet
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    sheetRef.current?.focus();
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const changeLang = (next: Lang) => {
    saveLang(next);
    if (next !== lang) goToLang(next);
  };

  return (
    <div
      className="fade-in fixed inset-0 z-50 flex items-end justify-center bg-black/25 backdrop-blur-sm sm:items-center sm:p-6 dark:bg-black/50"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        tabIndex={-1}
        className="glass-menu sheet-in max-h-[88vh] w-full overflow-y-auto rounded-t-[28px] pb-[max(16px,env(safe-area-inset-bottom))] shadow-[0_30px_80px_-20px_rgb(0_0_0/0.45)] outline-none sm:max-w-[460px] sm:rounded-[28px] sm:pb-4"
      >
        {/* Mobile sheet grabber */}
        <div className="mx-auto mt-2 h-1 w-9 rounded-full bg-muted/30 sm:hidden" aria-hidden />

        <header className="grid grid-cols-[1fr_auto_1fr] items-center px-4 pt-3 pb-2 sm:pt-4">
          <span />
          <h2 id="settings-title" className="text-[17px] font-semibold">
            {s.title}
          </h2>
          <button type="button" onClick={onClose} className="justify-self-end rounded-full px-3 py-1 text-[17px] font-semibold text-accent hover:opacity-80">
            {t.common.done}
          </button>
        </header>

        <div className="space-y-6 px-4 pt-2 pb-2">
          <Group title={s.appearance} footer={s.autoNote}>
            <div className="grid grid-cols-3 gap-3 p-4" role="radiogroup" aria-label={s.appearance}>
              {(
                [
                  ['light', s.light],
                  ['dark', s.dark],
                  ['system', s.auto],
                ] as [ThemePref, string][]
              ).map(([value, label]) => (
                <AppearanceTile key={value} value={value} label={label} selected={theme === value} onSelect={() => setTheme(value)} />
              ))}
            </div>
          </Group>

          <Group title={s.dock} footer={s.dockNote}>
            <Row label={s.position}>
              <Segmented<DockPosition>
                label={s.position}
                value={dock.position}
                onChange={(position) => setDock({ position })}
                options={[
                  ['left', s.left],
                  ['bottom', s.bottom],
                  ['right', s.right],
                ]}
              />
            </Row>
            <Row label={s.size}>
              <Segmented<DockSize>
                label={s.size}
                value={dock.size}
                onChange={(size) => setDock({ size })}
                options={[
                  ['s', s.small],
                  ['m', s.medium],
                  ['l', s.large],
                ]}
              />
            </Row>
          </Group>

          <Group title={s.language}>
            <Row label={s.language}>
              <Select id="settings-lang" label={s.language} className="w-auto min-w-32" value={lang} onChange={changeLang} options={LOCALES.map((l) => [l, LANG_NAMES[l]] as const)} />
            </Row>
          </Group>
        </div>
      </div>
    </div>
  );
}

/** One inset grouped section, as in iOS Settings */
function Group({ title, footer, children }: { title: string; footer?: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-1.5 px-4 text-[13px] font-medium text-muted">{title}</h3>
      <div className="divide-y divide-line overflow-hidden rounded-2xl bg-panel">{children}</div>
      {footer && <p className="mt-1.5 px-4 text-[12px] leading-snug text-muted">{footer}</p>}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-3 py-2 pr-2 pl-4">
      <span className="text-[15px]">{label}</span>
      {children}
    </div>
  );
}

/**
 * Preview thumbnail + label, like the appearance picker in macOS.
 * The preview depicts the theme itself, so it uses the actual light/dark colors instead of tokens.
 */
function AppearanceTile({ value, label, selected, onSelect }: { value: ThemePref; label: string; selected: boolean; onSelect: () => void }) {
  const light = { bg: '#ececf0', bar: '#ffffff', card: '#ffffff', line: '#d6d6dc' };
  const dark = { bg: '#141416', bar: '#2a2a2e', card: '#26262a', line: '#3a3a40' };

  const Mini = ({ c }: { c: typeof light }) => (
    <div className="absolute inset-0 p-1.5" style={{ background: c.bg }}>
      <div className="h-2 rounded-[3px]" style={{ background: c.bar }} />
      <div className="mt-1.5 grid grid-cols-2 gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex h-3.5 items-center gap-0.5 rounded-[3px] px-0.5" style={{ background: c.card }}>
            <span className="size-2 rounded-[2px]" style={{ background: i % 2 ? '#5e5ce6' : '#0a84ff' }} />
            <span className="h-0.5 flex-1 rounded" style={{ background: c.line }} />
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <button type="button" role="radio" aria-checked={selected} onClick={onSelect} className="group flex flex-col items-center gap-2 outline-none">
      <span
        className={`relative block aspect-[4/3] w-full overflow-hidden rounded-xl transition ${
          selected ? 'ring-[3px] ring-accent ring-offset-2 ring-offset-[var(--panel)]' : 'ring-1 ring-line group-hover:ring-muted/40'
        } group-focus-visible:ring-[3px] group-focus-visible:ring-accent/60`}
      >
        {value === 'system' ? (
          <>
            <Mini c={light} />
            <span className="absolute inset-0" style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 100%)' }}>
              <Mini c={dark} />
            </span>
          </>
        ) : (
          <Mini c={value === 'dark' ? dark : light} />
        )}
      </span>
      <span className={`flex items-center gap-1 text-[13px] ${selected ? 'font-semibold text-accent' : 'text-fg'}`}>
        {selected && <Check size={13} strokeWidth={3} />}
        {label}
      </span>
    </button>
  );
}

export default withI18n(SettingsSheet);
