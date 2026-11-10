import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { useT } from '../../i18n';

export default function CopyButton({ text, label, className = '' }: { text: string; label?: string; className?: string }) {
  const t = useT();
  const [state, setState] = useState<'idle' | 'ok' | 'fail'>('idle');
  return (
    <button
      type="button"
      className={`btn ${className}`}
      disabled={!text}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setState('ok');
        } catch {
          setState('fail');
        }
        setTimeout(() => setState('idle'), 1500);
      }}
    >
      {state === 'ok' ? <Check size={15} strokeWidth={2.6} className="text-ok" /> : <Copy size={14} strokeWidth={2.2} />}
      {state === 'ok' ? t.common.copied : state === 'fail' ? t.common.copyFailed : (label ?? t.common.copy)}
    </button>
  );
}
