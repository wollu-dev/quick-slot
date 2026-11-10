import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { useT } from '../../i18n';

interface Props<E extends boolean> {
  value: E extends true ? number | '' : number;
  onChange: (v: E extends true ? number | '' : number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Allow an empty field (value '') instead of falling back to min */
  allowEmpty?: E;
  id?: string;
  placeholder?: string;
  className?: string;
}

/**
 * Whole-number field with − / + buttons, used instead of <input type="number">,
 * whose native spinner arrows can't be styled. ↑ ↓ keys step the value too.
 */
export default function NumberField<E extends boolean = false>({ value, onChange, min, max, step = 1, allowEmpty, id, placeholder, className = '' }: Props<E>) {
  const t = useT();
  const [draft, setDraft] = useState<string | null>(null);
  const clamp = (n: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n));
  const emit = onChange as (v: number | '') => void;
  const current = value === '' ? null : (value as number);

  const commit = (text: string) => {
    if (text === '' || text === '-') {
      if (allowEmpty) emit('');
      else emit(clamp(min ?? 0));
      return;
    }
    const n = Number(text);
    if (Number.isFinite(n)) emit(clamp(Math.trunc(n)));
  };
  const bump = (dir: 1 | -1) => {
    setDraft(null);
    emit(clamp((current ?? min ?? 0) + (current === null ? 0 : dir * step)));
  };

  const atMin = current !== null && min !== undefined && current <= min;
  const atMax = current !== null && max !== undefined && current >= max;

  return (
    <div className={`input flex items-center gap-0.5 pr-1 focus-within:border-accent/60 focus-within:ring-4 focus-within:ring-accent/15 ${className}`}>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholder}
        value={draft ?? (current === null ? '' : String(current))}
        onChange={(e) => {
          const text = e.target.value.replace(min !== undefined && min >= 0 ? /\D/g : /(?!^-)[^\d]/g, '');
          setDraft(text);
          if (/^-?\d+$/.test(text) || (text === '' && allowEmpty)) commit(text);
        }}
        onBlur={() => {
          if (draft !== null) commit(draft);
          setDraft(null);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            bump(e.key === 'ArrowUp' ? 1 : -1);
          }
        }}
        className="h-full w-full min-w-0 bg-transparent tabular-nums outline-none placeholder:text-muted/80"
      />
      <StepButton label={t.picker.decrease} disabled={atMin} onClick={() => bump(-1)}>
        <Minus size={14} strokeWidth={2.6} />
      </StepButton>
      <StepButton label={t.picker.increase} disabled={atMax} onClick={() => bump(1)}>
        <Plus size={14} strokeWidth={2.6} />
      </StepButton>
    </div>
  );
}

function StepButton({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-7 shrink-0 place-items-center rounded-full text-muted transition hover:bg-[var(--raised)] hover:text-fg disabled:opacity-35 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}
