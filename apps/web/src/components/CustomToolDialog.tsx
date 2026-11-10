import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Trash2 } from 'lucide-react';
import { useT } from '../i18n';
import { CUSTOM_COLORS } from '../tools/registry';
import { addCustomTool, hostOf, MAX_NAME_LENGTH, normalizeUrl, removeCustomTool, updateCustomTool, type CustomTool } from '../lib/customTools';
import { LetterIcon } from './ui/AppIcon';

/** Add a custom (external) tool, or edit / delete one when `tool` is given */
export default function CustomToolDialog({ tool, onClose }: { tool?: CustomTool; onClose: () => void }) {
  const t = useT();
  const c = t.custom;
  const [name, setName] = useState(tool?.name ?? '');
  const [url, setUrl] = useState(tool?.url ?? '');
  const [color, setColor] = useState(tool?.color ?? 1);
  const [touched, setTouched] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [full, setFull] = useState(false);
  const urlRef = useRef<HTMLInputElement>(null);

  const normalized = normalizeUrl(url);
  const shownName = name.trim() || (normalized ? hostOf(normalized) : '');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    urlRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!normalized) return;
    const data = { name: shownName.slice(0, MAX_NAME_LENGTH), url: normalized, color };
    if (tool) {
      // A changed address is a different site: ask again before opening it
      updateCustomTool(tool.id, { ...data, trusted: normalized === tool.url ? tool.trusted : false });
    } else if (!addCustomTool(data)) {
      setFull(true);
      return;
    }
    onClose();
  };

  const remove = () => {
    if (!tool) return;
    if (!confirmDelete) return setConfirmDelete(true);
    removeCustomTool(tool.id);
    onClose();
  };

  return createPortal(
    <div
      className="fade-in fixed inset-0 z-50 flex items-end justify-center bg-black/25 backdrop-blur-sm sm:items-center sm:p-6 dark:bg-black/50"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="custom-tool-title"
        className="glass-menu sheet-in max-h-[88vh] w-full overflow-y-auto rounded-t-[28px] p-5 pb-[max(20px,env(safe-area-inset-bottom))] shadow-[0_30px_80px_-20px_rgb(0_0_0/0.45)] sm:max-w-[440px] sm:rounded-[28px]"
      >
        <div className="flex items-center gap-3">
          <LetterIcon name={shownName || '?'} color={color} size="lg" />
          <div className="min-w-0">
            <h2 id="custom-tool-title" className="text-[17px] font-semibold">
              {tool ? c.editTitle : c.addTitle}
            </h2>
            <p className="truncate text-[13px] text-muted">{shownName || c.addHint}</p>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <label className="label" htmlFor="custom-url">{c.url}</label>
            <input
              ref={urlRef}
              id="custom-url"
              className="input"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              placeholder="https://claude.ai/new"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onBlur={() => url && setTouched(true)}
              aria-invalid={touched && !normalized}
            />
            {touched && !normalized && <p className="mt-1 text-xs text-danger">{c.urlInvalid}</p>}
          </div>
          <div>
            <label className="label" htmlFor="custom-name">{c.name}</label>
            <input
              id="custom-name"
              className="input"
              autoComplete="off"
              maxLength={MAX_NAME_LENGTH}
              placeholder={c.namePlaceholder}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <fieldset>
            <legend className="label">{c.color}</legend>
            <div className="flex flex-wrap gap-2.5" role="radiogroup" aria-label={c.color}>
              {CUSTOM_COLORS.map((hex, i) => (
                <button
                  key={hex}
                  type="button"
                  role="radio"
                  aria-checked={color === i}
                  aria-label={`${c.color} ${i + 1}`}
                  onClick={() => setColor(i)}
                  className={`grid size-8 place-items-center rounded-full text-white transition ${color === i ? 'ring-[3px] ring-accent ring-offset-2 ring-offset-[var(--bg)]' : 'hover:scale-105'}`}
                  style={{ background: hex }}
                >
                  {color === i && <Check size={15} strokeWidth={3} />}
                </button>
              ))}
            </div>
          </fieldset>
          <p className="text-[12px] leading-snug text-muted">{c.storedNote}</p>
          {full && <p className="rounded-2xl bg-danger/10 p-3 text-sm text-danger">{c.full}</p>}
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {tool && (
            <button type="button" className={`btn ${confirmDelete ? 'bg-danger text-white hover:bg-danger' : 'text-danger'}`} onClick={remove}>
              <Trash2 size={15} strokeWidth={2.2} />
              {confirmDelete ? c.removeConfirm : c.remove}
            </button>
          )}
          <div className="ml-auto flex gap-2">
            <button type="button" className="btn" onClick={onClose}>
              {c.cancel}
            </button>
            <button type="submit" className="btn btn-primary">
              {tool ? t.common.save : c.confirmAdd}
            </button>
          </div>
        </div>
      </form>
    </div>,
    document.body,
  );
}
