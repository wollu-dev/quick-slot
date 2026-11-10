import { useMemo, useState } from 'react';
import CopyButton from '../../components/ui/CopyButton';
import DropZone from '../../components/ui/DropZone';
import { formatBytes } from '../../lib/files';

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return btoa(bin);
}

function base64ToBytes(b64: string): Uint8Array {
  let s = b64.trim().replace(/^data:[^,]*,/, '').replace(/\s/g, '').replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

const toUrlSafe = (s: string) => s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export default function Base64Tool() {
  const [tab, setTab] = useState<'text' | 'file'>('text');
  const [direction, setDirection] = useState<'encode' | 'decode'>('encode');
  const [text, setText] = useState('');
  const [urlSafe, setUrlSafe] = useState(false);
  const [fileOut, setFileOut] = useState<{ name: string; size: number; b64: string; mime: string } | null>(null);
  const [asDataUrl, setAsDataUrl] = useState(false);

  const result = useMemo(() => {
    if (!text) return { value: '' };
    try {
      if (direction === 'encode') {
        const b = bytesToBase64(new TextEncoder().encode(text));
        return { value: urlSafe ? toUrlSafe(b) : b };
      }
      return { value: new TextDecoder('utf-8', { fatal: true }).decode(base64ToBytes(text)) };
    } catch {
      return { value: '', error: direction === 'decode' ? '올바른 Base64가 아니거나, 텍스트가 아닌 파일 데이터예요' : '변환 실패' };
    }
  }, [text, direction, urlSafe]);

  const fileValue = fileOut ? (asDataUrl ? `data:${fileOut.mime || 'application/octet-stream'};base64,${fileOut.b64}` : urlSafe ? toUrlSafe(fileOut.b64) : fileOut.b64) : '';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-line p-0.5 text-sm">
          {([
            ['text', '텍스트'],
            ['file', '파일 → Base64'],
          ] as const).map(([k, label]) => (
            <button key={k} type="button" onClick={() => setTab(k)} className={`rounded-md px-3 py-1 ${tab === k ? 'bg-panel-2 text-fg' : 'text-muted'}`}>
              {label}
            </button>
          ))}
        </div>
        {tab === 'text' && (
          <div className="flex rounded-lg border border-line p-0.5 text-sm">
            {([
              ['encode', '인코딩'],
              ['decode', '디코딩'],
            ] as const).map(([k, label]) => (
              <button key={k} type="button" onClick={() => setDirection(k)} className={`rounded-md px-3 py-1 ${direction === k ? 'bg-panel-2 text-fg' : 'text-muted'}`}>
                {label}
              </button>
            ))}
          </div>
        )}
        <label className="flex items-center gap-1.5 text-sm">
          <input type="checkbox" checked={urlSafe} onChange={(e) => setUrlSafe(e.target.checked)} /> URL-safe (-_ 사용, = 제거)
        </label>
        {tab === 'file' && (
          <label className="flex items-center gap-1.5 text-sm">
            <input type="checkbox" checked={asDataUrl} onChange={(e) => setAsDataUrl(e.target.checked)} /> data URL 형식
          </label>
        )}
      </div>

      {tab === 'text' ? (
        <div className="grid gap-3 lg:grid-cols-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            placeholder={direction === 'encode' ? '인코딩할 텍스트' : '디코딩할 Base64'}
            className="input min-h-[40vh] resize-y font-mono text-[13px]"
          />
          <div className="relative">
            <textarea readOnly value={result.value} spellCheck={false} placeholder="결과" className="input min-h-[40vh] resize-y bg-panel font-mono text-[13px]" />
            {result.error && <p className="mt-1 text-sm text-danger">{result.error}</p>}
            {result.value && <CopyButton text={result.value} className="absolute right-3 top-3" />}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <DropZone
            multiple={false}
            compact={!!fileOut}
            hint="이미지를 CSS·HTML에 바로 넣을 때 유용해요"
            onFiles={async ([f]) => {
              const b64 = bytesToBase64(new Uint8Array(await f.arrayBuffer()));
              setFileOut({ name: f.name, size: f.size, b64, mime: f.type });
            }}
          />
          {fileOut && (
            <div className="panel space-y-2 p-4">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate font-mono">{fileOut.name}</span>
                <span className="shrink-0 text-xs text-muted">
                  {formatBytes(fileOut.size)} → {formatBytes(fileValue.length)}
                </span>
                <CopyButton text={fileValue} />
              </div>
              <textarea readOnly value={fileValue} className="input h-48 font-mono text-[11px]" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
