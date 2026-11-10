import type { KeyboardEventHandler, ReactNode } from 'react';

interface Props {
  /** Title shown in the header row (e.g. "Input", "Result") */
  label: string;
  value: string;
  /** Omit for a read-only output panel */
  onChange?: (value: string) => void;
  onKeyDown?: KeyboardEventHandler<HTMLTextAreaElement>;
  placeholder?: string;
  /** Buttons shown on the right of the header row (e.g. Copy, Save) */
  actions?: ReactNode;
  /** Tailwind min-height class for the text area */
  minHeight?: string;
}

/**
 * A text area inside a glass panel with a header row for its title and actions.
 * Buttons live in the header instead of floating over the text, so long text never runs
 * underneath them, and input and output panels side by side line up at the same height.
 */
export default function TextPanel({ label, value, onChange, onKeyDown, placeholder, actions, minHeight = 'min-h-[40vh]' }: Props) {
  const readOnly = !onChange;
  return (
    <section className="panel flex flex-col overflow-hidden" aria-label={label}>
      <header className="flex min-h-12 items-center justify-between gap-2 border-b border-line py-1.5 pr-1.5 pl-4">
        <h3 className="text-[13px] font-medium text-muted">{label}</h3>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </header>
      <textarea
        value={value}
        readOnly={readOnly}
        onChange={onChange && ((e) => onChange(e.target.value))}
        onKeyDown={onKeyDown}
        spellCheck={false}
        placeholder={placeholder}
        aria-label={label}
        className={`${minHeight} w-full flex-1 resize-y bg-transparent p-4 font-mono text-[13px] leading-relaxed text-fg outline-none placeholder:text-muted/80`}
      />
    </section>
  );
}
