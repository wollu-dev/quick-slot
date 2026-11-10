import { useState } from 'react';

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
      {state === 'ok' ? '✓ 복사됨' : state === 'fail' ? '복사 실패' : label}
    </button>
  );
}
