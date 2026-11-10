import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

export default function CopyButton({ text, label = '복사', className = '' }: { text: string; label?: string; className?: string }) {
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
      {state === 'ok' ? '복사됨' : state === 'fail' ? '복사 실패' : label}
    </button>
  );
}
