import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, FileUp, Scale, ShieldAlert, UserLock } from 'lucide-react';
import { useT } from '../i18n';
import Rich from '../i18n/Rich';
import { hostOf, launchCustomTool, updateCustomTool, type CustomTool } from '../lib/customTools';
import { LetterIcon } from './ui/AppIcon';

/**
 * Opening a custom (external) tool always goes through here: unless the user chose
 * "don't ask again" for that tool, a warning about file uploads, licenses and privacy is shown first.
 * Returns the launch function and the dialog element to render.
 */
export function useLaunchCustomTool(): [(tool: CustomTool) => void, ReactNode] {
  const [pending, setPending] = useState<CustomTool | null>(null);
  const launch = useCallback((tool: CustomTool) => {
    if (tool.trusted) launchCustomTool(tool);
    else setPending(tool);
  }, []);
  const dialog = pending ? createPortal(<Warning tool={pending} onClose={() => setPending(null)} />, document.body) : null;
  return [launch, dialog];
}

function Warning({ tool, onClose }: { tool: CustomTool; onClose: () => void }) {
  const t = useT();
  const c = t.custom;
  const [dontAsk, setDontAsk] = useState(false);
  // Focus starts on Cancel: a warning should never be confirmed by a stray key press
  // (e.g. the Enter that chose the tool in search would otherwise also press "Open")
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    cancelRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const open = () => {
    if (dontAsk) updateCustomTool(tool.id, { trusted: true });
    launchCustomTool(tool);
    onClose();
  };

  const items = [
    { icon: FileUp, title: c.warnFilesTitle, body: c.warnFiles },
    { icon: Scale, title: c.warnLicenseTitle, body: c.warnLicense },
    { icon: UserLock, title: c.warnPrivacyTitle, body: c.warnPrivacy },
  ];

  return (
    <div
      className="fade-in fixed inset-0 z-[60] flex items-end justify-center bg-black/25 backdrop-blur-sm sm:items-center sm:p-6 dark:bg-black/50"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="external-warn-title"
        className="glass-menu sheet-in max-h-[88vh] w-full overflow-y-auto rounded-t-[28px] p-5 pb-[max(20px,env(safe-area-inset-bottom))] shadow-[0_30px_80px_-20px_rgb(0_0_0/0.45)] sm:max-w-[460px] sm:rounded-[28px]"
      >
        <div className="flex items-center gap-3">
          <LetterIcon name={tool.name} color={tool.color} size="md" />
          <div className="min-w-0">
            <h2 id="external-warn-title" className="flex items-center gap-1.5 text-[17px] font-semibold">
              <ShieldAlert size={17} strokeWidth={2.2} className="shrink-0 text-danger" />
              {c.warnTitle}
            </h2>
            <p className="truncate font-mono text-[12px] text-muted" title={tool.url}>
              {tool.url}
            </p>
          </div>
        </div>

        <p className="mt-4 text-[14px] leading-relaxed">
          <Rich text={c.warnLead(hostOf(tool.url))} />
        </p>

        <ul className="mt-3 divide-y divide-line overflow-hidden rounded-2xl bg-panel">
          {items.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex gap-3 p-3.5">
              <Icon size={18} strokeWidth={2} className="mt-0.5 shrink-0 text-muted" />
              <div className="min-w-0">
                <p className="text-[14px] font-semibold">{title}</p>
                <p className="mt-0.5 text-[13px] leading-snug text-muted">{body}</p>
              </div>
            </li>
          ))}
        </ul>

        <label className="mt-4 flex items-center gap-2.5 text-[14px]">
          <input type="checkbox" checked={dontAsk} onChange={(e) => setDontAsk(e.target.checked)} />
          {c.dontAsk}
        </label>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button ref={cancelRef} type="button" className="btn" onClick={onClose}>
            {c.cancel}
          </button>
          <button type="button" className="btn btn-primary" onClick={open}>
            <ExternalLink size={15} strokeWidth={2.2} />
            {c.open}
          </button>
        </div>
      </div>
    </div>
  );
}
